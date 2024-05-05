console.log("TTVLookingGlass Extension Initiated. Created by SpaceshipCaptain");
//chrome
let guiObj = {
    expressInputBox: null,
    wrapper: null,
        topDiv: null,
            inputBox: null,
            infoDiv: null,
        botDiv: null,
};

let lgData = {
    suggestions: {},
    noVodData: null,
    ctrlState: null,
    url: null,
    timeStamp: null,
    options: {}
};

//loads options
chrome.storage.local.get(["options"], (data) => {
    if(data.options){
      lgData.options = data.options;
    }
    else{//defaults to false if no options
      lgData.options = {
        instantOpen: false,
        createClipLink: false,
        disableAutocomplete: false
      };
    }
});

//Loads names for suggestions
chrome.storage.local.get(["names"], (data) => {
    const names = data.names || {};
    lgData.suggestions = names;
});

//targets the prime loot crown on navbar
function expressCheck(){
    if(guiObj.expressInputBox){return;}//if it already exists
    if(window.location.hostname === "clips.twitch.tv"){return;}
    const eVTarget = document.querySelector("div.top-nav__prime");
    if(eVTarget){//if target exists create input
        expressVodSetup(eVTarget);
    }
}

//This has backup targets if the main embed target fails.
function underPlayerTarget() {
    let guiTarget = document.querySelector("div.metadata-layout__split-top");
    if(guiTarget){return guiTarget.parentNode;}
    if(window.location.hostname === "clips.twitch.tv"){
        //this one should be removed in the future if twitch settles on the new design
        guiTarget = document.querySelector("div.clips-watch");
        if(guiTarget && guiTarget.firstChild.childNodes.length > 2){return guiTarget.firstChild.lastChild;}
        //backup clip target for new design
        guiTarget = document.querySelector("div.clips-player");
        if(guiTarget){return guiTarget.childNodes[1];}
    }else{
        guiTarget = document.getElementById("live-channel-stream-information");
        if(guiTarget){return guiTarget.childNodes[0].childNodes[0];}
    }
}

//called to get vod player time
function getPlayerSeconds(){
    let time = document.querySelector("[data-a-target='player-seekbar-current-time']");
    if(!time){
        infoControl("noPlayerTime");
        return;
    }
    let timeSeconds = toSeconds(time.innerText);
    return timeSeconds;
}

window.onload=() =>{ 
    expressCheck();
    guiCheck();
    looper();
};

function expressVodSetup(target){
    guiObj.expressInputBox = target.parentNode.insertBefore(document.createElement("input"), target);
    guiObj.expressInputBox.setAttribute("id", "expressInputBox");
    guiObj.expressInputBox.setAttribute("class", "inputBox");
    guiObj.expressInputBox.setAttribute("placeholder", "Express Vod");
    guiObj.expressInputBox.setAttribute("spellcheck", "false");//no red lines
    guiObj.expressInputBox.setAttribute("autocomplete", "off");//no browser suggestions
    guiObj.expressInputBox.addEventListener("keydown", expressGo);
    if(!lgData.options.disableAutocomplete){//auto-complete option
        guiObj.expressInputBox.addEventListener("input", handleInput);
        guiObj.expressInputBox.addEventListener("keydown", inputQOL);
    }
}

function guiCheck(){
    //if gui already exists check if url changed.
    if(guiObj.wrapper){
        if(lgData.url === window.location.pathname){
            return;
        }
        guiObj.wrapper.remove();
        guiObj.wrapper = null;
        lgData.noVodData = null; //edgecase
    }
    if(!guiObj.wrapper){ //if gui doesn't exist: checks for building targets
        const url = window.location.pathname;
        if(url.includes("/videos/") || url.includes("/clip/") || window.location.hostname === "clips.twitch.tv"){
        const guiTarget = underPlayerTarget();
            if(guiTarget){
                guiConstructor(guiTarget);
                dataConstructor();
            }
        }
    }
}

function guiConstructor(target){
    lgData.url = window.location.pathname;
    guiObj.wrapper = target.parentNode.insertBefore(document.createElement("div"), target);
    guiObj.wrapper.setAttribute("id", "guiWrapper");

    guiObj.topDiv = guiObj.wrapper.appendChild(document.createElement("div"));
    guiObj.topDiv.setAttribute("id", "topDiv");

    guiObj.inputBox = guiObj.topDiv.appendChild(document.createElement("input"));
    guiObj.inputBox.setAttribute("id", "mainInputBox");
    guiObj.inputBox.setAttribute("class", "inputBox");
    guiObj.inputBox.setAttribute("placeholder", "Search Name");
    guiObj.inputBox.setAttribute("autocomplete", "off");
    guiObj.inputBox.setAttribute("spellcheck", "false");
    guiObj.inputBox.addEventListener("keydown", mainGo);
    if(!lgData.options.disableAutocomplete){
    guiObj.inputBox.addEventListener("input", handleInput);
    guiObj.inputBox.addEventListener("keydown", inputQOL);
    }

    guiObj.infoDiv = guiObj.topDiv.appendChild(document.createElement("div"));
    guiObj.infoDiv.setAttribute("id", "infoDiv");
    infoControl("default");

    guiObj.botDiv = guiObj.wrapper.appendChild(document.createElement("div"))
    guiObj.botDiv.setAttribute("id", "botDiv");
    //this just prevents context menu from popping up if you misclick
    guiObj.botDiv.addEventListener("contextmenu", function(event) {
        event.preventDefault();
    });
}

//colors
const red = "#f03a17";//not found
const green = "#72F176";//found link
const yellow = "#F4D35E";//commands

//to stop multiple inputs overlapping the timer
let infoResetTimeout;

function infoControl(textCode, name, nVods, placement){
    const info = guiObj.infoDiv;
    info.style.opacity = "0"; //fade out current info with css transition
    clearTimeout(infoResetTimeout);  //this is a js engine function
    setTimeout(() => { // Wait 200ms for fade out
        if(textCode === "default"){
            if(!lgData.noVodData){
                info.innerText =  "Enter name to search vods. Submit /options for settings and info.";
            }else{
                info.innerHTML = "No VOD data. Links generated may be inaccurate. Submit /options for more info.";
                info.classList.add("infoWarning");//set text to orange as warning that it might not be accurate
            }
            info.style.opacity = "1"; //need to set text to visible
            return; //skips reset info if setting to default
        }
        if(textCode === "foundVod"){
            const place = convertToOrdinal(placement);
            info.innerHTML = `<span style="color: ${green}">${name}</span>`;
            info.innerHTML += ` Found in ${place} VOD of ${nVods}. Right-click bubble for details.`;
        }
        else if(textCode === "noFoundVod"){
            const vodBefore = convertToOrdinal(placement);
            const vodAfter = convertToOrdinal(placement+1);
            info.innerHTML = `<span style="color: ${red};">${name}</span>`;
            info.innerHTML +=` Not found. Searched ${nVods} VODs and this occurred in between ${vodBefore} and ${vodAfter} VODs.`;
        }
        else if(textCode === "oldVods"){
            info.innerHTML = `<span style="color: ${red};">${name}</span>`;
            info.innerHTML +=` All ${nVods} VODs are older than this.`;
        }
        else if(textCode === "olderThanVods"){
            info.innerHTML = `<span style="color: ${red};">${name}</span>`;
            info.innerHTML +=` This is older than all ${nVods} VODs.`;
        }
        //commands
        else if(textCode === "removedName"){
            info.innerHTML = `<span style="color: ${yellow};">${name}</span>`;
            info.innerHTML += ` removed from suggestions.`;
        }
        else if(textCode === "removedAllNames"){
            info.innerHTML = `<span style="color: ${yellow};">All name suggestions have been cleared.</span>`;
        }
        else if(textCode === "clear"){
            info.innerHTML = `<span style="color: ${yellow};">Cleared all links.</span>`;
        }
        //error codes
        else if(textCode === "noUser"){
            info.innerHTML = `<span style="color: ${red};">Twitch user not found. Try again.</span>`;
            flashRed(guiObj.inputBox);
        }
        else if(textCode === "zeroVods"){
            info.innerHTML = `<span style="color: ${red};">${name}</span>`;
            info.innerHTML +=" has 0 vods.";
        }
        else if(textCode === "noPlayerTime"){
            info.innerHTML = `<span style='color: ${red};'>ERROR: Can't find player time. Might be an ad running? Contact Dev if error persists.</span>`;
        }
        else if(textCode === "notInSuggestions"){
            info.innerHTML = `<span style='color: ${red};'>${name}</span>`;
            info.innerHTML +=" was not in suggestions list.";
        }
        else if(textCode === "notVod"){
            info.innerHTML = `<span style='color: ${red};'>Not a VOD: LookingGlass disabled.</span>`;
            guiObj.inputBox.remove(); //disabling the GUI for highlights/uploads
            guiObj.botDiv.remove(); //leaving the wrapper so the gui doesn't regen
            info.style.opacity = "1"; //because of return
            setTimeout(() => {guiObj.topDiv.remove()}, 4500);
            return;
        }
        info.style.opacity = "1"; // Fade in new info
        infoResetTimeout = setTimeout(resetInfo, 8000);
    }, 200);
}

function resetInfo(){
        infoControl("default");
        infoResetTimeout = null;
}

function getSlug(){ //gets url slug
    return window.location.pathname.substring(window.location.pathname.lastIndexOf("/") + 1);
}

const dataConstructor = async () => {
    //clip data constructing
    if (window.location.pathname.includes("/clip/") || window.location.hostname === "clips.twitch.tv") {
        const apiClipObj = await apiFetch(clipQuery(getSlug()));
        const name = apiClipObj.clip.broadcaster.login;
        //if clip has a vod attached get exact timestamp of clip by adding offset to vod start time.
        if(apiClipObj.clip.videoOffsetSeconds){
        lgData.timeStamp = (Date.parse(apiClipObj.clip.video.createdAt)/1000)+apiClipObj.clip.videoOffsetSeconds;
        if(lgData.options.createClipLink){
            setTimeout(() => { //added a delay for looks
                apiUserVods(userVideosQuery(name, 100), true);//true = don't save name
            }, 600);
        }
        }else{//gets the clip creation timestamp subtracts 30 seconds as a guess
            lgData.noVodData = true;
            infoControl("default"); //warn that links might be inaccurate because no vod timestamp.
            lgData.timeStamp = Math.floor(Date.parse(apiClipObj.clip.createdAt)/1000)-30;
            //try to find vod if vod isn't attached in data
            setTimeout(() => { //added a delay for looks
                apiUserVods(userVideosQuery(name, 100), true);//true = don't save name
            }, 600);
        }
    //vod data constructing
    } else if (window.location.pathname.includes("/videos/")) {
        const apiVodObj = await apiFetch(videoQuery(getSlug()));
        if(apiVodObj.video.broadcastType === "ARCHIVE"){
        //timestamp to the start time of the vod. add player time on input
        lgData.timeStamp = (Date.parse(apiVodObj.video.createdAt)/1000);
        } else{
            infoControl("notVod");
        }
    }
};

function looper() {
    setTimeout(() => {
        expressCheck();
        guiCheck();
        looper();
    }, 2000);
}

function expressGo(event){
    if (event.code === "Enter" || event.keyCode === 13){
        const exValue = event.target.value;
        if(exValue === ""){flashRed(guiObj.expressInputBox);return;}
        if(exValue.startsWith("-")) {
            removeName(exValue.substring(1)); // Removes the "-"
        }else if(exValue.startsWith("/")){
            commandInput(exValue);
        }
        else{apiReturnExpress(userVideosQuery(exValue, 1));}
        guiObj.expressInputBox.value = "";
    }
}

function mainGo(event){
    if (event.code === "Enter" || event.keyCode === 13){
        const name = getInput();
        //true if control is held down during enter press false if not
        lgData.ctrlState = event.getModifierState("Control");
        if(!name){return;}
        apiUserVods(userVideosQuery(name, 100));
    }
}

function getInput(){
    let value = guiObj.inputBox.value;
    guiObj.inputBox.value = "";
    if (value.startsWith("/")){
        commandInput(value);
        return;
    }
    if (value.startsWith("-")) {
        removeName(value.substring(1)); // Removes the "-"
        return;
    }
    value = value.replace(/\W/g, "");//clears the input of non alphanumeric characters
    if(value === ""){
        flashRed(guiObj.inputBox);
        return;
    }
    return value;
}

//clear a name from suggestions list
function removeName(name) {
    const lowercaseName = name.toLowerCase();
    if(lgData.suggestions[lowercaseName]) {
      delete lgData.suggestions[lowercaseName];
      const suggestions = lgData.suggestions;
      chrome.storage.local.set({ names: suggestions }, () => {
        if(guiObj.wrapper){infoControl("removedName", name)};
      });
    }
    else{
        if(guiObj.wrapper){infoControl("notInSuggestions", name)};
    }
}

//clear all suggestions
function clearAllNames() {
    lgData.suggestions = {};
    chrome.storage.local.set({ names: {} }, () => {
        infoControl("removedAllNames")
    });
}

function commandInput(command){
    const input = command.substring(1).toLowerCase();
    if(input === "options" || input === "settings"){
        chrome.runtime.sendMessage({ action: "openOptionsPage" });
    }
    else if(input === "clear" && guiObj.wrapper){
        clearBubbles();
    }
    else if (input === "clearallnames") {
        clearAllNames();
    }
}

function clearBubbles(){
    const newBotDiv = document.createElement("div");
    newBotDiv.setAttribute("id", "botDiv");
    //Prevent context menu from popping up on misclick
    newBotDiv.addEventListener("contextmenu", function(event) {
        event.preventDefault();
    });
    guiObj.wrapper.replaceChild(newBotDiv, guiObj.botDiv);
    guiObj.botDiv = newBotDiv;
    infoControl("clear");
}

function flashRed(targetBox) {
    targetBox.classList.add("error");
    setTimeout(() => {
        targetBox.classList.remove("error");
    }, 500);
}

//gql queries more information here https://kawcco.com/twitch-graphql-api/
//video id input gets video info back
function videoQuery(input){
    const videoq =(
      `query {
        video(id: ${input}) {
              createdAt
              lengthSeconds
              id
              broadcastType
              owner{
                login
                displayName
              }
        }
      }`);
    return videoq;
}
//twitch name input gets videos back ninput is number of videos you want
function userVideosQuery(input,ninput){
  const userq =(
    `query {
      user(login: "${input}") {
        videos(first:${ninput}, type: ARCHIVE) {
          edges {
          node {
          id
          createdAt
          lengthSeconds
          }
          }
        }
        login
        displayName
      }
    }`);
    return userq;
}
//clip slug input and gets clip info back
function clipQuery(input){
    const query =(
      `query {
        clip(slug: "${input}") {
            broadcaster{
                login
            }
            createdAt
            durationSeconds
            videoOffsetSeconds
            video{
              id
              createdAt
            }
        }
        }`);
    return query;
}

// using gql api that is not supported by twitch but it's easier
const apiFetch = async (input) => {
    let gqlfetch = fetch(`https://gql.twitch.tv/gql`, {
      method: `POST`,
      body: JSON.stringify({query: input}),
      headers: {"Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko"}
    });
    return gqlfetch
      .then(response => response.json())
      .then((data) => {
        return data.data;
      });
};

//user input to get single video link back and open latest vod
const apiReturnExpress = async (input) => {
    const a = await apiFetch(input);
    if(!a.user){ //if no user exit
        flashRed(guiObj.expressInputBox);
        return;
    }
    saveName(a.user.login); //saves name if valid
    if(a.user.videos.edges.length === 0){//no videos return
        flashRed(guiObj.expressInputBox)
        return
    };
    const link =("https://twitch.tv/videos/").concat(a.user.videos.edges[0].node.id);
    window.open(link, "_blank");
};

const apiUserVods = async (input, doNotSave) => { //user information api call
    const temp = await apiFetch(input);
    if(!temp.user){infoControl("noUser");return}
    if(!doNotSave){ //so it doesn't save name from auto-links on clips
        saveName(temp.user.login); //save for suggestions
    }
    if(temp.user.videos.edges.length < 1){//if they have no vods exit
        infoControl("zeroVods", temp.user.displayName);
        return;
    }
    vodArraySearch(temp.user.videos.edges, temp.user.displayName, doNotSave);
};

function toSeconds(time) { //Input: "00:46:12" -> Output: 2772
    const [hours = 0, minutes = 0, seconds = 0] = time.split(":").map(Number);
    return (hours * 3600) + (minutes * 60) + seconds;
}

function secondsCalc(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}h${minutes}m${seconds}s`;
}

function convertToOrdinal(number) { //numbers to 1st 2nd 3rd etc
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

function constructLink(vodID,time){
    const link = ("https://twitch.tv/videos/").concat((vodID).concat("?t=")).concat(time);
    return link;
}

function vodArraySearch(array, name, doNotSave){
    let currentVodTime;
    if (lgData.url.includes("/clip/") || window.location.hostname === "clips.twitch.tv"){
        currentVodTime = 0;
    }else{
        currentVodTime = getPlayerSeconds()
        if(!currentVodTime){return}
    }
    let timeStamp = lgData.timeStamp + currentVodTime;
    //if timestamp is newer than the end of the first vod don't search
    if(timeStamp > (Date.parse(array[0].node.createdAt)/1000)+array[0].node.lengthSeconds){
        infoControl("oldVods", name, array.length)
        return;
    }
    //if timestamp is older than the start of the oldest vod don't search
    if(timeStamp < Date.parse(array[array.length-1].node.createdAt)/1000){
        infoControl("olderThanVods", name, array.length)
        return;
    }
    for(let i = 0; i < array.length; i++){
        let vodStart = (Date.parse(array[i].node.createdAt)/1000)
        let vodEnd = (Date.parse(array[i].node.createdAt)/1000)+array[i].node.lengthSeconds
        if(timeStamp < vodStart){continue;}//check the next vod
        if(timeStamp < vodEnd){//creates green bubble
            const urlTime = secondsCalc(timeStamp-vodStart)
            const link = constructLink(array[i].node.id, urlTime)
            if(lgData.ctrlState || (lgData.options.instantOpen && !doNotSave)){window.open(link, "_blank")}
            constructGreenBubble(link, name, urlTime); //make green bubble
            infoControl("foundVod", name, array.length, i+1) //add 1 because starts at 0
            break;
        } else{
            infoControl("noFoundVod", name, array.length, i); //no vod found info
            break;
        }
    }
}

function constructGreenBubble(link, name, urlTime) {
    const bubble = guiObj.botDiv.appendChild(document.createElement("div"));
    bubble.setAttribute("class", "bubble");

    // Display channel name in bubble
    const targetName = bubble.appendChild(document.createElement("p"));
    targetName.setAttribute("class", "targetName");
    targetName.innerText = name

    //for bubble rclick display data
    bubble.setAttribute("data-targetTime", "@" + urlTime);
    if(lgData.url.includes("/videos/")){//for vods
    bubble.setAttribute("data-playerTime", secondsCalc(getPlayerSeconds()) + "➔");
    }else{bubble.setAttribute("data-playerTime","➔")};

    bubble.addEventListener("contextmenu", function(event) {
        event.preventDefault();
        bubble.classList.toggle("active");
        close.classList.toggle("active");
    });
    // Open link in a new tab when clicked
    bubble.addEventListener("click", function() {
        window.open(link, "_blank");
    });

    // Add close button
    const close = guiObj.botDiv.appendChild(document.createElement("div"));
    close.setAttribute("class", "closeLink");
    close.innerText = "❌";
    close.addEventListener("click", function() {
        bubble.remove();
        close.remove();
        infoControl("default")
    });
}

//Save a new name to storage
function saveName(name) {
    if(lgData.options.disableAutocomplete){return;}
    const lowerCaseName = name.toLowerCase()
    //if name already saved, use it's input number. else set it 0 then +1 to either
    lgData.suggestions[lowerCaseName] = (lgData.suggestions[lowerCaseName] || 0) + 1;
    chrome.storage.local.set({ names: lgData.suggestions }, () => {});
}

function autocomplete(input) {
    const inputValue = input.value.toLowerCase();
    const suggestions = Object.entries(lgData.suggestions)
      .filter(([name]) => name.startsWith(inputValue))
      .sort((a, b) => b[1] - a[1]) //Sort by frequency in descending order
      .map(([name]) => name); //Extract just the name
    return suggestions[0] || ""; //Return the first suggestion or an empty string
}

// Function to handle user input
function handleInput(event) {
    if(lgData.options.disableAutocomplete){return;}
    const input = event.target;
    const position = input.selectionStart;
    if(!input.value){return;}
    const suggestion = autocomplete(input);

    if(suggestion && event.inputType !== "deleteContentBackward") {
        const newValue = input.value.substring(0, position) + suggestion.substring(input.value.length);
        input.value = newValue;
        // Move cursor to the end of the inserted text
        input.setSelectionRange(position, position + suggestion.length);
    }
}

//quality of life shortcuts for autocomplete input
function inputQOL(event){
    const input = event.target;
    if (event.key === "Tab") {// Move cursor to the end
        event.preventDefault();
        input.setSelectionRange(input.value.length, input.value.length);
        return;
    }
    if (event.key === "Backspace" && event.ctrlKey) {
        input.value = ""; //set input to blank
        return;
    }
}