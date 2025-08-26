console.log("TTVLookingGlass Extension Initiated. Created by SpaceshipCaptain");
//Firefox
let guiObj = {
    expressWrapper: null,
    expressInputBox: null,
    mainWrapper: null,
    topDiv: null,
    inputBox: null,
    infoDiv: null,
    botDiv: null,
};

let lgData = {
    site: null,
    targetAPI: null,
    suggestions: {
        twitch: {},
        kick: {}
    },
    noVodData: null,
    ctrlState: null,
    url: null,
    timeStamp: null,
    options: {}
};

//loads options
browser.storage.local.get(["options"], (data) => {
    if (data.options) {
        lgData.options = data.options;
    }
    else {//defaults to false if no options
        lgData.options = {
            instantOpen: false,
            createClipLink: true,
            disableAutocomplete: false
        };
    }
});

browser.storage.local.get(["suggestions"], (data) => {
    if (data.suggestions) {
        // If new format exists, use it
        lgData.suggestions = data.suggestions;
    } else {
        // Check for legacy "names" format and migrate
        browser.storage.local.get(["names"], (legacyData) => {
            if (legacyData.names) {
                lgData.suggestions.twitch = legacyData.names;
                lgData.suggestions.kick = {};

                // Save in new format and remove old format
                browser.storage.local.set({ suggestions: lgData.suggestions });
                browser.storage.local.remove(["names"]);
            } else {
                // No existing data, start fresh
                lgData.suggestions = {
                    twitch: {},
                    kick: {}
                };
            }
        });
    }
});

// Odd bug with firefox and kick.com would make window.onload never trigger.
// so just removed that for now and it should be fine
const host = window.location.hostname;
if (host.includes("twitch.tv")) {
    lgData.site = "twitch";
} else if (host.includes("kick.com")) {
    lgData.site = "kick";
}
looper();

function looper() {
    setTimeout(() => {
        expressCheck();
        guiCheck();
        looper();
    }, 2000);
}

//This has backup targets if the main embed target fails.
function twitchTargets() {
    let guiTarget = document.querySelector("div.metadata-layout__split-top");
    if (guiTarget) { return guiTarget.parentNode; }
    if (window.location.hostname === "clips.twitch.tv") {
        //backup clip target for new design
        guiTarget = document.querySelector("div.clips-player");
        if (guiTarget) { return guiTarget.childNodes[1]; }
    } else {
        guiTarget = document.getElementById("live-channel-stream-information");
        if (guiTarget) { return guiTarget.childNodes[0].childNodes[0]; }
    }
}

function kickTargets() {
    let target = document.querySelector('div.relative.flex.flex-col.gap-4.px-4');
    if (target) { return target }

    const main = document.querySelector('main')
    if (main && main.childNodes[1]) {
        return main.childNodes[1]
    }
}

function expressCheck() {
    const existingInputBox = document.getElementById("expressInputBox");
    if (existingInputBox) return;

    if (lgData.site === "twitch") {
        if (window.location.hostname === "clips.twitch.tv") { return; }
        const target = document.querySelector("div.top-nav__search-container");
        if (target) {
            expressVodSetup(target.parentNode);
            setApiState("twitch");
        }
    } else if (lgData.site === "kick") {
        const nav = document.querySelector("nav")
        expressVodSetup(nav.childNodes[1])
        setApiState("kick");
    }
}

function expressVodSetup(target) {
    // this is kinda hacky
    if (lgData.site === "twitch") {
        target.style.position = "relative";
    }

    guiObj.expressWrapper = document.createElement("div");
    guiObj.expressWrapper.setAttribute("id", "expressWrapper");
    target.appendChild(guiObj.expressWrapper);

    guiObj.expressInputBox = document.createElement("input");
    const expressIconContainer = createIconToggle(guiObj.expressInputBox);
    guiObj.expressWrapper.appendChild(expressIconContainer);
    // append the inputbox after creating the icons for ordering
    guiObj.expressWrapper.appendChild(guiObj.expressInputBox);

    guiObj.expressInputBox.setAttribute("id", "expressInputBox");
    guiObj.expressInputBox.classList.add("inputBox");
    guiObj.expressInputBox.setAttribute("placeholder", "Express Vod");
    guiObj.expressInputBox.setAttribute("spellcheck", "false");//no red lines
    guiObj.expressInputBox.setAttribute("autocomplete", "off");//no browser suggestions
    guiObj.expressInputBox.addEventListener("keydown", expressGo);
    if (!lgData.options.disableAutocomplete) {//auto-complete option
        guiObj.expressInputBox.addEventListener("input", handleInput);
        guiObj.expressInputBox.addEventListener("keydown", inputQOL);
    }
}

function expressGo(event) {
    if (event.code === "Enter" || event.keyCode === 13) {
        const name = processInput(guiObj.expressInputBox);

        if (name) {
            expressAPI(name);
        }
    }
}

//user input to get single video link back and open latest vod
const expressAPI = async (input) => {
    try {
        const data = await apiCall({
            site: lgData.targetAPI,
            queryType: "userVideos",
            username: input,
            nVods: 1
        })
        if (data && data.login) { //saves name if valid
            saveName(data.login, lgData.targetAPI);
        }
        if (data && data.videos.length > 0) {
            setTimeout(() => { //dumbest patch but firefox won't save name without this delay
                window.open(data.videos[0].link, "_blank");
            }, 100);
        } else {
            flashRed(guiObj.expressInputBox);
        }
    } catch (error) {
        flashRed(guiObj.expressInputBox);
    }
};

function createIconToggle(inputBox) {
    const iconContainer = document.createElement("div");
    iconContainer.setAttribute("class", "iconContainer");

    const twitchIcon = iconContainer.appendChild(document.createElement("img"));
    twitchIcon.setAttribute("class", "api-icon twitch-icon");
    twitchIcon.setAttribute("src", chrome.runtime.getURL("icons/twitch.svg"));

    const kickIcon = iconContainer.appendChild(document.createElement("img"));
    kickIcon.setAttribute("class", "api-icon kick-icon");
    kickIcon.setAttribute("src", chrome.runtime.getURL("icons/kick.svg"));

    // Left or Right click icon to toggle the API target
    iconContainer.addEventListener("click", (event) => {
        event.preventDefault();
        toggleApiTarget();
        inputBox.focus();
    });
    iconContainer.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        toggleApiTarget();
        inputBox.focus();
    });

    return iconContainer;
}

function guiCheck() {
    const existingGUI = document.getElementById("mainWrapper");
    const url = window.location.pathname;
    // if the GUI matches current url do nothing else remove it
    if (existingGUI) {
        if (lgData.url === url) {
            return;
        } else {
            existingGUI.remove();
            guiObj.mainWrapper = null;
            lgData.noVodData = null;
        }
    }

    if (lgData.site === "twitch") {
        if (url.includes("/video") || url.includes("/clip/") || window.location.hostname === "clips.twitch.tv") {
            const guiTarget = twitchTargets();
            if (guiTarget) {
                guiConstructor(guiTarget);
                dataConstructor();
                setApiState("twitch")
            }
        }
    } else if (lgData.site === "kick") {
        if (url.includes("/videos/") || url.includes("/clips/")) {
            const guiTarget = kickTargets();
            if (guiTarget) {
                guiConstructor(guiTarget);
                dataConstructor();
                setApiState("kick", true)
            }
        }
    }
}

function guiConstructor(target) {
    lgData.url = window.location.pathname;
    guiObj.mainWrapper = target.parentNode.insertBefore(document.createElement("div"), target);
    guiObj.mainWrapper.setAttribute("id", "mainWrapper");

    guiObj.topDiv = guiObj.mainWrapper.appendChild(document.createElement("div"));
    guiObj.topDiv.setAttribute("id", "topDiv");

    guiObj.inputBox = document.createElement("input");
    const mainIconContainer = createIconToggle(guiObj.inputBox);
    guiObj.topDiv.appendChild(mainIconContainer);

    guiObj.topDiv.appendChild(guiObj.inputBox)
    guiObj.inputBox.setAttribute("id", "mainInputBox");
    guiObj.inputBox.setAttribute("class", "inputBox");
    guiObj.inputBox.setAttribute("autocomplete", "off");
    guiObj.inputBox.setAttribute("spellcheck", "false");
    guiObj.inputBox.addEventListener("keydown", mainGo);
    if (!lgData.options.disableAutocomplete) {
        guiObj.inputBox.addEventListener("input", handleInput);
        guiObj.inputBox.addEventListener("keydown", inputQOL);
    }

    guiObj.infoDiv = guiObj.topDiv.appendChild(document.createElement("div"));
    guiObj.infoDiv.setAttribute("id", "infoDiv");
    infoControl("default");

    guiObj.botDiv = guiObj.mainWrapper.appendChild(document.createElement("div"))
    guiObj.botDiv.setAttribute("id", "botDiv");
    //this just prevents context menu from popping up if you misclick
    guiObj.botDiv.addEventListener("contextmenu", (event) => {
        event.preventDefault();
    });
}

function toggleApiTarget() {
    const nextSite = lgData.targetAPI === "twitch" ? "kick" : "twitch";
    setApiState(nextSite);
}

function setApiState(site, suppressInfo = false) {
    if (site !== "twitch" && site !== "kick") {
        return;
    }

    lgData.targetAPI = site;
    const isTwitch = site === "twitch";

    if (guiObj.mainWrapper) {
        guiObj.mainWrapper.classList.toggle("twitch", isTwitch);
        guiObj.mainWrapper.classList.toggle("kick", !isTwitch);
        guiObj.inputBox.setAttribute("placeholder", isTwitch ? "Search Twitch" : "Search Kick");
        // don't update info on first render
        if (!suppressInfo) {
            infoControl(isTwitch ? "targetTwitch" : "targetKick");
        }
    }

    const expressWrapper = document.getElementById("expressWrapper");
    if (expressWrapper) {
        expressWrapper.classList.toggle("twitch", isTwitch);
        expressWrapper.classList.toggle("kick", !isTwitch);
    }
}

// colors
const colors = {
    twitch: "#bc92fb",
    kick: "#53fc18",
    error: "#f03a17",// red
    warn: "#F4D35E"// yellow
};

// to stop multiple inputs overlapping the timer
let infoResetTimeout;

const messages = {
    default: () => lgData.noVodData
        ? "No VOD data. Links generated may be inaccurate. Submit /options for more info."
        : "Enter name to search vods. Submit /options for settings and info.",

    targetTwitch: () =>
        `Searching&nbsp;<span style="color:${colors.twitch};">Twitch</span>. Use shift+tab inside of inputbox to toggle via hotkey.`,

    targetKick: () =>
        `Searching&nbsp;<span style="color:${colors.kick};">Kick</span>. Use shift+tab inside of inputbox to toggle via hotkey.`,

    foundVod: (name, nVods, placement, api) => {
        const place = convertToOrdinal(placement);
        return `<span style="color:${colors[api]};">${name}</span>&nbsp;Found in ${place} VOD of ${nVods}. Right-click bubble for details.`;
    },

    noFoundVod: (name, nVods, placement) => {
        const vodBefore = convertToOrdinal(placement);
        const vodAfter = convertToOrdinal(placement + 1);
        return `<span style="color:${colors.error};">${name}</span>&nbsp;Not found. Searched ${nVods} VODs and this occurred in between ${vodBefore} and ${vodAfter} VODs.`;
    },

    oldVods: (name, nVods) =>
        `<span style="color:${colors.error};">${name}</span>&nbsp;All ${nVods} VODs are older than this.`,

    olderThanVods: (name, nVods) =>
        `<span style="color:${colors.error};">${name}</span>&nbsp;This is older than all ${nVods} VODs.`,

    removedName: (name) =>
        `<span style="color:${colors.warn};">${name}</span>&nbsp;removed from suggestions.`,

    removedTwitchNames: () =>
        `<span style="color:${colors.warn};">Twitch suggestions have been cleared.</span>`,

    removedKickNames: () =>
        `<span style="color:${colors.warn};">Kick suggestions have been cleared.</span>`,

    removedAllNames: () =>
        `<span style="color:${colors.warn};">All suggestions have been cleared.</span>`,

    clear: () =>
        `<span style="color:${colors.warn};">Cleared all links.</span>`,

    noUser: () =>
        `<span style="color:${colors.error};">User not found. Try again.</span>`,

    zeroVods: (name) =>
        `<span style="color:${colors.error};">${name}</span>&nbsp;has 0 vods.`,

    noPlayerTime: () =>
        `<span style='color:${colors.error};'>ERROR: Can't find player time. Contact Dev if error persists.</span>`,

    notInSuggestions: (name) =>
        `<span style='color:${colors.error};'>${name}</span>&nbsp;was not in suggestions list.`,

    twitchAPIFail: () =>
        `<span style='color:${colors.error};'>ERROR: Twitch API did not return data. Contact Dev if this persists.</span>`,

    kickAPIFail: () =>
        `<span style='color:${colors.error};'>ERROR: Kick API did not return data. Contact Dev if this persists.</span>`,

    apiFail: () =>
        `<span style='color:${colors.error};'>ERROR: API did not return data. Contact Dev if this persists.</span>`,

    notVod: () =>
        `<span style='color:${colors.error};'>Not a VOD: LookingGlass disabled.</span>`
};

function infoControl(textCode, name, nVods, placement) {
    const info = guiObj.infoDiv;
    clearTimeout(infoResetTimeout);

    let newText = "";

    if (messages[textCode]) {
        newText = messages[textCode](name, nVods, placement, lgData.targetAPI);
    }

    if (lgData.noVodData) {
        info.classList.add("infoWarning");
    }

    if (textCode === "noUser") {
        flashRed(guiObj.inputBox);
    }

    if (textCode === "apiFail" || textCode === "notVod") {
        if (guiObj.inputBox) guiObj.inputBox.remove();
        if (textCode === "notVod" && guiObj.botDiv) guiObj.botDiv.remove();
        setTimeout(() => { if (guiObj.topDiv) guiObj.topDiv.remove(); }, 4500);
    }

    info.style.opacity = "0";
    setTimeout(() => {
        info.innerHTML = newText;
        info.style.opacity = "1";

        if (textCode !== "default") {
            infoResetTimeout = setTimeout(resetInfo, 6000);
        }
    }, 200);
}

function resetInfo() {
    infoControl("default");
    infoResetTimeout = null;
}

function getSlug() { //gets url slug
    return window.location.pathname.substring(window.location.pathname.lastIndexOf("/") + 1);
}

function getPlayerSeconds() {
    let videoElement;
    // twitch doesn't have a stable tag on it's player directly so find the container
    // and search within for the video player
    if (lgData.site === "twitch") {
        const videoContainer = document.querySelector('[data-a-target="video-ref"]');
        if (videoContainer) {
            videoElement = videoContainer.querySelector("video");
        }

    } else if (lgData.site == "kick") {
        videoElement = document.getElementById('video-player');
    }

    // fallback just searches for a video element but this is less reliable
    if (!videoElement) {
        videoElement = document.querySelector("video");
    }
    if (!videoElement) {
        infoControl("noPlayerTime");
        return
    }
    //currentTime returns seconds but it's floating point so floor it
    const seconds = Math.floor(videoElement.currentTime);
    return seconds;
}

function dateToSeconds(date) {
    return Math.floor(Date.parse(date) / 1000)
}

// this is way more verbose than necessary but it's easy to follow
const dataConstructor = async () => {
    if (lgData.site === "twitch") {
        try {
            if (window.location.pathname.includes("/clip/") || window.location.hostname === "clips.twitch.tv") {
                await handleTwitchClip();
            } else if (window.location.pathname.includes("/video")) {
                await handleTwitchVideo();
            }
        } catch (error) {
            console.error("Error in dataConstructor:", error);
            infoControl("twitchAPIFail");
        }
    } else if (lgData.site === "kick") {
        try {
            if (window.location.pathname.includes("/clips/")) {
                await handleKickClip();
            } else if (window.location.pathname.includes("/videos/")) {
                await handleKickVideo();
            }
        } catch (error) {
            console.error("Error in dataConstructor:", error);
            infoControl("kickAPIFail");
        }
    }
};

async function handleTwitchClip() {
    const apiClip = await apiCall({
        site: lgData.site,
        queryType: "clip",
        slug: getSlug()
    });

    if (apiClip.vodOffsetSeconds) {
        lgData.timeStamp = dateToSeconds(apiClip.vod.createdAt) + apiClip.vodOffsetSeconds;

        if (lgData.options.createClipLink) {
            setTimeout(() => searchUserVods(apiClip.login, true), 600);
        }
    } else {
        lgData.noVodData = true;
        infoControl("default");
        lgData.timeStamp = dateToSeconds(apiClip.createdAt) - 30;
        setTimeout(() => searchUserVods(apiClip.login, true), 600);
    }
}

async function handleKickClip() {
    const apiClip = await apiCall({
        site: lgData.site,
        queryType: "clip",
        slug: getSlug()
    });

    if (apiClip.vod) {
        lgData.timeStamp = dateToSeconds(apiClip.vod.createdAt) + (apiClip.vodOffsetSeconds || 0);

        if (lgData.options.createClipLink) {
            setTimeout(() => searchUserVods(apiClip.login, true), 600);
        }
    } else {
        lgData.noVodData = true;
        infoControl("default");
        lgData.timeStamp = dateToSeconds(apiClip.createdAt) - 30;
    }
}

async function handleTwitchVideo() {
    const apiVodObj = await apiCall({
        site: lgData.site,
        queryType: "video",
        slug: getSlug()
    });

    if (!apiVodObj) {
        infoControl("twitchAPIFail");
        return
    }

    if (apiVodObj.broadcastType === "ARCHIVE") {
        lgData.timeStamp = dateToSeconds(apiVodObj.createdAt);
    } else {
        infoControl("notVod");
    }
}

async function handleKickVideo() {
    const apiVideo = await apiCall({
        site: lgData.site,
        queryType: "video",
        slug: getSlug()
    });

    if (!apiVideo) {
        infoControl("kickAPIFail");
        return
    }
    lgData.timeStamp = dateToSeconds(apiVideo.createdAt);
}

function mainGo(event) {
    // keyCode 13 is also enter
    if (event.code === "Enter" || event.keyCode === 13) {
        const name = processInput(guiObj.inputBox);
        //true if control is held down during enter press false if not
        lgData.ctrlState = event.ctrlKey;
        if (!name) { return; }
        searchUserVods(name);
    }
}

function processInput(inputBox) {
    let value = inputBox.value;
    inputBox.value = "";
    if (value.startsWith("/")) {
        commandInput(value, inputBox);
        return;
    }
    if (value.startsWith("-")) {
        removeName(value.substring(1)); // Removes the "-"
        return;
    }
    value = value.replace(/\W/g, "");//clears the input of non alphanumeric characters
    if (value === "") {
        flashRed(inputBox);
        return;
    }
    return value;
}

function removeName(name) {
    const lowercaseName = name.toLowerCase();
    const targetSite = lgData.targetAPI;

    if (lgData.suggestions[targetSite] && lgData.suggestions[targetSite][lowercaseName]) {
        delete lgData.suggestions[targetSite][lowercaseName];

        browser.storage.local.set({ suggestions: lgData.suggestions }, () => {
            if (guiObj.mainWrapper) { infoControl("removedName", name) };
        });
    } else {
        if (guiObj.mainWrapper) { infoControl("notInSuggestions", name) };
    }
}

function clearAllNames(site = null) {
    if (site) {
        // Clear only specific site
        lgData.suggestions[site] = {};
    } else {
        // Clear all sites
        lgData.suggestions = {
            twitch: {},
            kick: {}
        };
    }

    browser.storage.local.set({ suggestions: lgData.suggestions }, () => {
        if (!site) {
            infoControl("removedAllNames");
        } else if (site === "twitch") {
            infoControl("removedTwitchNames");
        } else if (site === "kick") {
            infoControl("removedKickNames");
        }
    });
}

function commandInput(command, inputBox) {
    const input = command.substring(1).toLowerCase();
    if (input === "options" || input === "settings") {
        browser.runtime.sendMessage({ type: "openOptionsPage" });
    }
    else if (input === "clear" && guiObj.mainWrapper) {
        clearBubbles();
    }
    else if (input === "clearallnames") {
        clearAllNames();
    }
    else if (input === "cleartwitch") {
        clearAllNames("twitch");
    }
    else if (input === "clearkick") {
        clearAllNames("kick");
    } else {
        flashRed(inputBox)
    }
}

function clearBubbles() {
    const newBotDiv = document.createElement("div");
    newBotDiv.setAttribute("id", "botDiv");
    //Prevent context menu from popping up on misclick
    newBotDiv.addEventListener("contextmenu", function (event) {
        event.preventDefault();
    });
    guiObj.mainWrapper.replaceChild(newBotDiv, guiObj.botDiv);
    guiObj.botDiv = newBotDiv;
    infoControl("clear");
}

function flashRed(targetBox) {
    targetBox.classList.add("error");
    setTimeout(() => {
        targetBox.classList.remove("error");
    }, 500);
}

async function apiCall({ site, queryType, slug, username, nVods }) {
    return new Promise((resolve, reject) => {
        browser.runtime.sendMessage(
            {
                type: "apiRequest",
                payload: { site, queryType, slug, username, nVods }
            },
            (response) => {
                if (browser.runtime.lastError) {
                    reject(new Error(browser.runtime.lastError.message));
                    return;
                }
                if (!response) {
                    reject(new Error("No response from background script"));
                    return;
                }
                if (response.ok) {
                    resolve(response.data);
                } else {
                    if (response.error && response.error.type !== 'not_found') {
                        console.error("API Error:", response.error);
                    }
                    reject(response.error);
                }
            }
        );
    });
}

function formatSeconds(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}h${minutes}m${seconds}s`;
}

function convertToOrdinal(number) {
    if (number % 100 >= 11 && number % 100 <= 13) {
        return number + "th";
    }
    switch (number % 10) {
        case 1:
            return number + "st";
        case 2:
            return number + "nd";
        case 3:
            return number + "rd";
        default:
            return number + "th";
    }
}

// automated is true when this is called automatically but is false
// when user inputs. So it doesn't save non-user inputs
async function searchUserVods(username, automated) {
    try {
        const apiData = await apiCall({
            site: lgData.targetAPI,
            queryType: "userVideos",
            username: username,
            nVods: 100
        });

        if (!automated) { //so it doesn't save name from auto-links on clips
            saveName(apiData.login, lgData.targetAPI);
        }
        const array = apiData.videos;
        const displayName = apiData.displayName;

        if (array.length < 1) {//if they have no vods exit
            infoControl("zeroVods", displayName);
            return;
        }

        let currentVodTime = 0;

        if (lgData.url.includes("/video")) {
            currentVodTime += getPlayerSeconds()
        }
        let timeStamp = lgData.timeStamp + currentVodTime;

        // provide index of vod array and return seconds
        function getStartSeconds(index) {
            return Date.parse(array[index].createdAt) / 1000;
        }

        //if timestamp is newer than the end of the first vod don't search
        if (timeStamp > (getStartSeconds(0) + array[0].durationSeconds)) {
            infoControl("oldVods", displayName, array.length)
            return;
        }
        //if timestamp is older than the start of the oldest vod don't search
        if (timeStamp < getStartSeconds(array.length - 1)) {
            infoControl("olderThanVods", displayName, array.length)
            return;
        }

        // search from the newest to oldest. newer the time, bigger the number
        for (let i = 0; i < array.length; i++) {
            let vodStart = getStartSeconds(i)
            let vodEnd = getStartSeconds(i) + array[i].durationSeconds;
            // less = older so try next vod
            if (timeStamp < vodStart) {
                continue;
            }
            // time stamp is greater than vod start or previous if would have caught it
            // so this only needs to check if it's less than the vodEnd time
            if (timeStamp < vodEnd) {
                const urlTimeSeconds = timeStamp - vodStart;
                let urlTimeFormatted = formatSeconds(urlTimeSeconds)
                let link = `${array[i].link}?t=`
                if (lgData.targetAPI === "twitch") {
                    link = link.concat(urlTimeFormatted)
                } else {
                    link = link.concat(urlTimeSeconds.toString())
                }
                // only open in new tab if ctrl is held or if instant open option is on and
                // this wasn't called automatically
                if (lgData.ctrlState || (lgData.options.instantOpen && !automated)) {
                    setTimeout(() => { // should fix this firefox bug a different way but works for now
                        window.open(link, "_blank")
                    }, 100);
                }
                constructLinkBubble(link, displayName, urlTimeFormatted, currentVodTime);
                infoControl("foundVod", displayName, array.length, i + 1)
                return;
            } else {
                infoControl("noFoundVod", displayName, array.length, i); //no vod found info
                return;
            }
        }
    } catch (error) {
        if (error.type === 'not_found') {
            infoControl("noUser");
        } else {
            infoControl("apiFail", lgData.targetAPI);
        }
    }
}

function constructLinkBubble(link, name, urlTime, currentVodTime) {
    const container = guiObj.botDiv.appendChild(document.createElement("div"));
    container.classList.add("bubble-container");

    const bubble = container.appendChild(document.createElement("a"));
    bubble.classList.add("bubble");
    bubble.href = link;
    bubble.target = "_blank";

    if (link.includes("twitch.tv")) {
        bubble.classList.add("twitch");
    } else if (link.includes("kick.com")) {
        bubble.classList.add("kick");
    }

    // Player time (before name)
    const playerTime = bubble.appendChild(document.createElement("span"));
    playerTime.className = "playerTime";
    if (currentVodTime > 0) { // clips are 0 and add no origin time
        playerTime.innerText = formatSeconds(currentVodTime) + "➔";
    } else {
        playerTime.innerText = "➔";
    }

    // Channel name
    const targetName = bubble.appendChild(document.createElement("span"));
    targetName.className = "targetName";
    targetName.innerText = name;

    // Vod time (after name)
    const targetTime = bubble.appendChild(document.createElement("span"));
    targetTime.className = "targetTime";
    targetTime.innerText = "@" + urlTime;

    // Close button
    const close = container.appendChild(document.createElement("button"));
    close.className = "closeLink";
    close.innerText = "❌";
    close.addEventListener("click", function (event) {
        event.stopPropagation(); // Prevents clicks from propagating
        container.remove(); // Remove the entire container
        infoControl("default");
    });

    container.addEventListener("contextmenu", function (event) {
        event.preventDefault();
        container.classList.toggle("active");
    });
}

function saveName(name, targetSite) {
    if (lgData.options.disableAutocomplete) { return }

    const lowerCaseName = name.toLowerCase();

    // Ensure the site object exists
    if (!lgData.suggestions[targetSite]) {
        lgData.suggestions[targetSite] = {};
    }
    // If name already saved, use its input number, else set it 0 then +1
    lgData.suggestions[targetSite][lowerCaseName] = (lgData.suggestions[targetSite][lowerCaseName] || 0) + 1;

    browser.storage.local.set({ suggestions: lgData.suggestions }, () => { });
}

function autocomplete(input) {
    const inputValue = input.value.toLowerCase();
    const targetSite = lgData.targetAPI || lgData.site;
    const siteSuggestions = lgData.suggestions[targetSite] || {};
    const suggestions = Object.entries(siteSuggestions)
        .filter(([name]) => name.startsWith(inputValue))
        .sort((a, b) => b[1] - a[1]) // Sort by frequency in descending order
        .map(([name]) => name); // Extract just the name

    return suggestions[0] || ""; // Return the first suggestion or an empty string
}

function handleInput(event) {
    if (lgData.options.disableAutocomplete) { return; }
    const input = event.target;
    const position = input.selectionStart;
    if (!input.value) { return; }
    const suggestion = autocomplete(input);

    if (suggestion && event.inputType !== "deleteContentBackward") {
        const newValue = input.value.substring(0, position) + suggestion.substring(input.value.length);
        input.value = newValue;
        // Move cursor to the end of the inserted text
        input.setSelectionRange(position, position + suggestion.length);
    }
}

//quality of life shortcuts for autocomplete input
function inputQOL(event) {
    const input = event.target;
    if (event.key === "Tab") {
        if (event.shiftKey) { // shift tab: toggle api target
            event.preventDefault();
            toggleApiTarget()
            // clears the current suggestion (highlighted part)
            input.value = input.value.substring(0, input.selectionStart)
            // tries to find new suggestion
            handleInput(event)
        } else { // no shift: move cursor to the end 
            event.preventDefault();
            input.setSelectionRange(input.value.length, input.value.length);
            return;
        }
    }
    if (event.key === "Backspace" && event.ctrlKey) {
        input.value = "";
        return
    }
}
