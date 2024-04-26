console.log('TTVLookingGlass Extension Initiated. Created by @SpaceshipCapt')
//firefox
let guiObj = {
    expressInputBox: null,
    wrapper: null,
        topDiv: null,
            inputBox: null,
            infoDiv: null,
        botDiv: null,
    data: {
        suggestions: {},
        url: null,
        ctrlState: null,
        timeStamp: null
    }
}

//target divs for extention embed. I am trying to use more permanent relative tags so the extension doens't break when twitch updates tags
function expressTarget(){ //https://i.imgur.com/vJ1MMic.png highlighted is what I am selecting
    console.log("expressTarget")
    return document.querySelector('div.top-nav__prime');
}

function tvSlashTarget() { //target for .tv/videos/ and .tv/clips/ https://i.imgur.com/xEJQe0m.png
    console.log("tvSlashTarget")
    const qS = document.querySelector('div.metadata-layout__split-top'); 
    return qS ? qS.parentNode : null; //if target exists return parentNode else return null
}

function playerTimeTarget(){ // https://i.imgur.com/t0sLphB.png
    console.log("playerTimeTarget")
    const qS = document.querySelector('[data-a-target="player-seekbar-current-time"]'); 
    return qS ? qS.innerText : null; //returns the current vod time
}

function clipsDotTarget(){ //clips.twitch.tv target
    console.log("clipsDotTarget")
    const qS = document.querySelector('div.clips-watch div'); //selects the div inside of div.cips-watch
    if (qS && qS.childNodes.length > 2) { // Check if qS exists and has 3 child nodes
        return qS.childNodes[qS.childNodes.length - 1]; // Returns the last div inside of qS
    } else { //extra checks required becuase I am selecting a target that loads first and the guiwrapper was loading above player occasionally.
        return null; 
    }
}

window.onload = async () => {
    // Load names from local storage
    guiObj.data.suggestions = await loadNames();
     //on load start looping
    expressCheck();
    guiCheck();
    looper();
};

function expressCheck(){
    //console.log("expressCheck")
    if(!guiObj.expressInputBox){ //if express doesn't exist try to generate it
        expressVodSetup(expressTarget());
    }
}

function expressVodSetup(target){
    console.log("expressVodSetup");
    if(!target){return}; //will just return if target isn't on page
    guiObj.expressInputBox = target.parentNode.insertBefore(document.createElement('input'), target); //expressVodDiv inserts before target
    guiObj.expressInputBox.setAttribute("id", "expressInputBox");
    guiObj.expressInputBox.setAttribute("placeholder", "Express Vod");
    guiObj.expressInputBox.setAttribute("spellcheck", "false") //turns off browser spell check red lines
    initializeExpressListener();
    guiObj.expressInputBox.addEventListener('input', handleInput);
    guiObj.expressInputBox.addEventListener('keydown', inputQOL);
}

function guiCheck(){
    //console.log("guiCheck");
    if(guiObj.wrapper){ //if gui already on page checks if the url it was created under matches current url
        if(guiObj.data.url != window.location.pathname.substring(window.location.pathname.lastIndexOf("/") + 1)){
            guiObj.wrapper.remove();
            guiObj.wrapper = null;
        }
    }
    if(!guiObj.wrapper){ //if gui doesn't exist on page: checks for building targets
        if(tvSlashTarget()){
            guiConstructor(tvSlashTarget())
            dataConstructor()
        };
        if(clipsDotTarget()){ 
            guiConstructor(clipsDotTarget())
            dataConstructor()
        };
    }
}

function guiConstructor(target){
    console.log("guiConstructor");
    guiObj.data.url = window.location.pathname.substring(window.location.pathname.lastIndexOf("/") + 1);
    guiObj.wrapper = target.parentNode.insertBefore(document.createElement('div'), target)
    guiObj.wrapper.setAttribute("id", "guiWrapper");

    guiObj.topDiv = guiObj.wrapper.appendChild(document.createElement('div'))
    guiObj.topDiv.setAttribute("id", "topDiv")

    guiObj.inputBox = guiObj.topDiv.appendChild(document.createElement('input'))
    guiObj.inputBox.setAttribute("id", "inputBox")
    guiObj.inputBox.setAttribute("placeholder", "Channel Name")
    guiObj.inputBox.setAttribute("autocomplete", "off") //turns off browser default autocomplete
    guiObj.inputBox.setAttribute("spellcheck", "false") //turns off browser spell check red lines
    initializeGuiListener();
    guiObj.inputBox.addEventListener('input', handleInput);
    guiObj.inputBox.addEventListener('keydown', inputQOL);

    guiObj.infoDiv = guiObj.topDiv.appendChild(document.createElement('div'));
    guiObj.infoDiv.setAttribute("id", "infoDiv");
    infoControl("default");

    guiObj.botDiv = guiObj.wrapper.appendChild(document.createElement('div'))
    guiObj.botDiv.setAttribute("id", "botDiv")
    guiObj.botDiv.addEventListener("contextmenu", function(event) {
        event.preventDefault(); //this just prevents context menu from popping up if you misRclick around bubbles
    });    
    
}

function infoControl(option){
    console.log("infoControl");
    if(option === "default"){
        guiObj.infoDiv.innerText =  "Enter name to search vods. Submit /settings for more information and shortcuts"
    }
    if(option === "novod"){
        guiObj.infoDiv.innerHTML = "No VOD data; links generated may be inaccurate. More info in /settings"
        guiObj.infoDiv.style.color = "#D68029"; //set text to orange as warning that it might not be accurate
    }
    if(option === "noUser"){
        guiObj.infoDiv.innerHTML = "<span style='color: #f03a17;'>Twitch user not found. Try again.</span>"
        flashRed(guiObj.inputBox);
    }

}
function getSlug(){ //gets url slug
    console.log("getSlug");
    return window.location.pathname.substring(window.location.pathname.lastIndexOf("/") + 1)
}

const dataConstructor = async () => {
    console.log("dataConstructor");
    if (window.location.pathname.includes("/clip/") || window.location.hostname === "clips.twitch.tv") {//clip data constructing
        const apiClipObj = await apiFetch(clipQuery(getSlug()));
        const name = apiClipObj.clip.broadcaster.login
        apiUserVods(userVideosQuery(name, 100)) //try to find vod on load as a replacement for twitch's watch full vod button
        console.log(apiClipObj);
    if(apiClipObj.clip.videoOffsetSeconds){ //if clip has a vod attached get exact timestamp of clip by adding offset to vod start time.
        guiObj.data.timeStamp = (Date.parse(apiClipObj.clip.video.createdAt)/1000)+apiClipObj.clip.videoOffsetSeconds
    }
    else{ //this gets the clip creation timestamp subtracts 30 seconds as a guess but can be way off if clip made from vod
        infoControl("novod"); //warn that links might be inaccurate because no vod timestamp.
        guiObj.data.timeStamp = (Date.parse(apiClipObj.clip.createdAt)/1000)-30
    }

    //vod data constructing
    } else if (window.location.pathname.includes("/videos/") || window.location.pathname.includes("/video/")) {
        const apiVodObj = await apiFetch(videoQuery(getSlug()));
        if(apiVodObj.video.broadcastType === "ARCHIVE"){
        guiObj.data.timeStamp = (Date.parse(apiVodObj.video.createdAt)/1000) //this sets the timestamp to the start time of the vod. Have to add the player time when user inputs
        } else{
            guiObj.inputBox.remove(); //disabling the GUI for highlights or uploads because it won't work
            guiObj.infoDiv.innerText = "Not a VOD. LookingGlass disabled."
            guiObj.botDiv.remove(); //leaving the wrapper so the gui doesn't regen
        }
    }
}

function getType(){
    if (window.location.pathname.includes("/clip/") || window.location.hostname === "clips.twitch.tv") {
        return "clip";
    }else{
        return "vod"
    };
}

function looper() {
    //console.log("looper");
    setTimeout(() => {
        expressCheck();
        guiCheck();
        looper();
    }, 2000);
}

function initializeExpressListener(){
    console.log("initializeExpressListener");
    guiObj.expressInputBox.addEventListener("keydown", (event) =>{
        if(event.defaultPrevented){return;}
        switch(event.code) {
            case "Enter": case "NumpadEnter":
                if(guiObj.expressInputBox.value === ""){flashRed(guiObj.expressInputBox);return}
                else if (guiObj.expressInputBox.value.startsWith('-')) {
                    nameRemover(guiObj.expressInputBox.value);
                    guiObj.expressInputBox.value = "";
                    return;
                }
                else{apiReturnExpress(userVideosQuery(guiObj.expressInputBox.value, 1))}
                guiObj.expressInputBox.value = "";
        }
    })
}

function initializeGuiListener(){
    console.log("initializeGuiListener");
    guiObj.inputBox.addEventListener("keydown", (event) =>{
        if(event.defaultPrevented){return;}
        switch(event.code) {
            case "Enter": case "NumpadEnter":
            guiObj.data.ctrlState = event.getModifierState("Control") //true if control is held down during enter press false if isn't held down
            const name = getInput()
            if(!name){return;}
            apiUserVods(userVideosQuery(name, 100));
        }
    })
}

function getInput(){
    console.log("getInput");
    let value = guiObj.inputBox.value
    if (value.startsWith('-')) {
        nameRemover(value);
        guiObj.inputBox.value = "";
        return;
    }
    value = value.replace(/\W/g, '');//clears the input of non alphanumeric characters
    if(value === ""){
        flashRed(guiObj.inputBox);
        guiObj.inputBox.value = "";
        return;
    }
    guiObj.inputBox.value = "";
    return value;
}
function nameRemover(value){
    const name = value.substring(1); // Remove the '-' prefix
    if (name === 'clearallsuggestions') {
        clearAllEntries();
    } else {
        removeName(name);
    }
    return;
}

function flashRed(targetBox) {
    targetBox.classList.add('error');
    setTimeout(() => {
        targetBox.classList.remove('error');
    }, 500);
}

//gql queries //moreinformation here https://supersonichub1.github.io/twitch-graphql-api/
function videoQuery(input){ //video id input gets video info back
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
    return videoq
};

function userVideosQuery(input,ninput){ //twitch name input gets videos back ninput is number of videos you want
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
};

function clipQuery(input){ //clip slug input and gets clip info back
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
        }`)
    return query;
};

const apiFetch = async (input) => { // using gql api that is not supported by twitch but helix is pain
    console.log("apiFetch");
    let gqlfetch = fetch(`https://gql.twitch.tv/gql`, {
      method: `POST`, 
      body: JSON.stringify({query: input}),
      headers: {"Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",}
    })
    return gqlfetch
      .then(response => response.json())
      .then((data) => {
        return data.data;
      });
};

const apiReturnExpress = async (input) => { //user input to get single video link back and open latest vod
    console.log("apiReturnExpress");
    const a = await apiFetch(input);
    if(!a.user){ //if no user exit
        flashRed(guiObj.expressInputBox);
        return;
    } 
    saveName(a.user.login); //save name for suggestions only if it's a valid twitch name
    if(a.user.videos.edges.length === 0){ //if user exists but has no videos just exit
        flashRed(guiObj.expressInputBox)
        return
    }; 
    const link =("https://twitch.tv/videos/").concat(a.user.videos.edges[0].node.id);
    window.open(link, "_blank");
};

const apiUserVods = async (input) => { //user information api call
    console.log("apiUserVods");
    const temp = await apiFetch(input);
    if(!temp.user){infoControl("noUser");return}
    saveName(temp.user.login); //if it's a valid twitch name save name for suggestions
    if(temp.user.videos.edges.length < 1){ //if they have no vods exit
        guiObj.infoDiv.innerHTML = "<span style='color: #f03a17;'>No VOD found.</span>";
        guiObj.infoDiv.innerHTML +=` ${temp.user.displayName}  has 0 vods.`;
        return;
    }
    vodArraySearch(temp.user.videos.edges, temp.user.displayName);
};

function toSeconds(time) { //Input: "00:46:12" -> Output: 2772
    const [hours = 0, minutes = 0, seconds = 0] = time.split(':').reverse().map(Number);
    return (hours * 3600) + (minutes * 60) + seconds;
}

function secondsCalc(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}h${minutes}m${seconds}s`;
}

function getPlayerSeconds(){
    console.log("getPlayerSeconds");
    let time = playerTimeTarget()
    if(!time){
        guiObj.infoDiv.innerHTML = "<span style='color: #f03a17;'>ERROR: Can't find player time.</span>";
        return;
    }
    let timeSeconds = toSeconds(time);
    return timeSeconds;
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
    console.log("constructLink");
    const link = ("https://twitch.tv/videos/").concat((vodID).concat("?t=")).concat(time);
    return link;
}

function vodArraySearch(array, name){
    console.log("vodArraySearch");
    let currentVodTime = playerTimeTarget() ? getPlayerSeconds() : 0; //if target exists gets the playertime in seconds else sets it to 0
    let timeStamp = guiObj.data.timeStamp + currentVodTime;
    if(timeStamp > (Date.parse(array[0].node.createdAt)/1000)+array[0].node.lengthSeconds){ //if timestamp is newer than the end of the first vod don't search
        guiObj.infoDiv.innerHTML = "<span style='color: #f03a17;'>No VOD found.</span>";
        guiObj.infoDiv.innerHTML +=` All ${array.length} of ${name}'s  VODs are older than this.`;
        return;
    }
    if(timeStamp < Date.parse(array[array.length-1].node.createdAt)/1000){ //if timestamp is older than the start of the oldest vod don't search
        guiObj.infoDiv.innerHTML = "<span style='color: #f03a17;'>No VOD found.</span>";
        guiObj.infoDiv.innerHTML +=` This is older than all ${array.length} of ${name} VODs.`;
        return;
    }
    for(let i = 0; i < array.length; i++){
        let vodStart = (Date.parse(array[i].node.createdAt)/1000)
        let vodEnd = (Date.parse(array[i].node.createdAt)/1000)+array[i].node.lengthSeconds
        if(timeStamp < vodStart){continue;} //if timestamp is less than the start of a vod, check the next vod
        if(timeStamp < vodEnd){ //timeStamp > vodStart is implied because of the previous if statement
            const urlTime = secondsCalc(timeStamp-vodStart) //gets number of seconds into the vod and converts it
            if(guiObj.data.ctrlState){window.open(constructLink(array[i].node.id, urlTime), "_blank")}
            constructGreenBubble(constructLink(array[i].node.id, urlTime), name); //make green bubble
            foundVodInfoControl(name, convertToOrdinal(i+1), array.length) //set info
            break;
        } else{
            noVodInfoControl(name, i, array.length); //no vod found info
            break;
        }
    }
}

function foundVodInfoControl(name, placement, numberOfVods){
    guiObj.infoDiv.innerHTML = `<span style='color: #FFD700;'>Found</span>`;
    guiObj.infoDiv.innerHTML += ` in ${name}'s ${placement} VOD of ${numberOfVods}. Right-click bubble for details.`;
}

function noVodInfoControl(name, placement, numberOfVods){
    const vodBefore = convertToOrdinal(placement)
    const vodAfter = convertToOrdinal(placement+1)
    guiObj.infoDiv.innerHTML = `<span style='color: #f03a17;'>No VOD found.</span>`;
    guiObj.infoDiv.innerHTML +=` Searched ${numberOfVods} of ${name}'s  VODs and this occurred inbetween ${vodBefore} and ${vodAfter} VODs.`;
}

function constructGreenBubble(link, name) {
    console.log("constructGreenBubble");

    //building bubble
    const bubble = guiObj.botDiv.appendChild(document.createElement('div'));
    bubble.setAttribute("class", "bubble");

    // Display channel name in bubble
    const targetName = bubble.appendChild(document.createElement('p'));
    targetName.setAttribute("class", "targetName");
    targetName.innerText = name
    //targetName.innerText = name.toUpperCase();

    //for bubble rclick display data
    const reg = /([^\=]+$)/; //after the last '='
    bubble.setAttribute("data-targetTime", "@" + reg.exec(link)[0]); //Extract outgoing time from link
    if(getType() === "vod"){ //if its a vod get player time for display
    bubble.setAttribute("data-playerTime", secondsCalc(getPlayerSeconds()) + "➔");
    }else{bubble.setAttribute("data-playerTime","➔")}; //clips = blank

    // Open link in a new tab when clicked
    bubble.addEventListener("click", function() { 
        window.open(link, "_blank");
    });

    // Add close button
    const close = guiObj.botDiv.appendChild(document.createElement('div')); 
    close.setAttribute("class", "closeLink");
    close.innerText = "❌";
    close.addEventListener("click", function() {
        bubble.remove();
        close.remove();
        infoControl("default")
    });

    // Toggle active state on right-click
    bubble.addEventListener("contextmenu", function(event) {
        event.preventDefault();
        bubble.classList.toggle("active");
        targetName.classList.toggle("active");
        close.classList.toggle("active");
    });
}

// Save a new name to storage
function saveName(name) {
    const lowerCaseName = name.toLowerCase()
    guiObj.data.suggestions[lowerCaseName] = (guiObj.data.suggestions[lowerCaseName] || 0) + 1;
    const suggestions = guiObj.data.suggestions;
    browser.storage.local.set({ names: suggestions }, () => {});
}

// Load names from storage
function loadNames() {
    return new Promise((resolve) => {
      browser.storage.local.get(['names'], (data) => {
        const names = data.names || {};
        resolve(names);
      });
    });
}

//clear a name from suggestions list
function removeName(name) {
    const lowercaseName = name.toLowerCase();
    if (guiObj.data.suggestions[lowercaseName]) {
      delete guiObj.data.suggestions[lowercaseName];
      const suggestions = guiObj.data.suggestions;
      browser.storage.local.set({ names: suggestions }, () => {
        guiObj.infoDiv.innerHTML = `${name} cleared from suggestions.`;
        guiObj.inputBox.value = "";
      });
    }
}

//clear all suggestions
function clearAllEntries() {
    guiObj.data.suggestions = {};
    browser.storage.local.set({ names: {} }, () => {
        guiObj.infoDiv.innerHTML = "All suggestions cleared.";
    });
}

function autocomplete(input) {
    const inputValue = input.value.toLowerCase();
    const suggestions = Object.entries(guiObj.data.suggestions)
      .filter(([name]) => name.startsWith(inputValue))
      .sort((a, b) => b[1] - a[1]) // Sort by frequency in descending order
      .map(([name]) => name); // Extract just the name
  
    return suggestions[0] || ''; // Return the first suggestion or an empty string
}

// Function to handle user input
function handleInput(event) {
    console.log("handleInput");
    const input = event.target;
    const position = input.selectionStart;
    if (!input.value) return;

    const suggestion = autocomplete(input);

    if (suggestion && event.inputType !== 'deleteContentBackward') {
        const newValue = input.value.substring(0, position) + suggestion.substring(input.value.length);
        input.value = newValue;
        // Move cursor to the end of the inserted text
        input.setSelectionRange(position, position + suggestion.length);
    }
}

function inputQOL(event){ //tab moves cursor to end of suggestion and you can delete everything with ctrl+backspace
    const input = event.target;
    if (event.key === "Tab") {
        event.preventDefault(); // Prevent default Tab behavior
        input.setSelectionRange(input.value.length, input.value.length); // Move cursor to the end
        return;
    }
    if (event.key === 'Backspace' && event.ctrlKey) {
        input.value = ""; //set input to blank
        return;
    } 
}
