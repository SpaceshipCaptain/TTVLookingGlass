console.log('TTVLookingGlass Extension Initiated. Created by @SpaceshipCapt')
//chrome 

var gob = {}; //global object because I'm lazy
var inputed = []; //array of successful inputs

//target query divs for extention embed
const clipsdot = "div.Layout-sc-nxg1ff-0.jlryzx"; //clips.twitch.tv selects div below and inserts above
const slashclips = "div.Layout-sc-nxg1ff-0.cNlzFP";  //twitch.tv/moonmoon/clips selects div below and inserts above
const slashvideos = "div.Layout-sc-nxg1ff-0.cNlzFP"; //twitch.tv/video/numbers selects div below and inserts above
const playertime = '.CoreText-sc-cpl358-0.Azerv[data-a-target="player-seekbar-current-time"]'; //.innertext of this selects the current vod time
const expresstarget = 'div.Layout-sc-nxg1ff-0.fedngu'; //express vod target left of prime loot crown

//on load start looping
window.onload=() =>{ 
   looper()};

function looper() {
//console.log("looper")
    setTimeout(() => {
        if(document.querySelector(expresstarget) != null && (document.getElementById('expressvod'))=== null){ //checks to see if element is there and then generates if it isn't
                expressvod();}
        if((document.querySelector(clipsdot) || document.querySelector(slashclips) || document.querySelector(slashvideos) != null)){ //checks if any of the selectors are on page
            if(document.getElementById('finderwrap') != null && (document.querySelector("#finderwrap").classList[0] != window.location.pathname.substring(window.location.pathname.lastIndexOf("/") + 1))){
                document.getElementById('finderwrap').remove()} //checks if box exists and if the box class does not match url it removes the box
            if(document.getElementById('finderwrap') === null){
                urlchecker();} //if the box does not exist check url and probably create one
            else{looper();}
        }
        else{looper();}
    }, 3000);
}

function urlchecker(){
//console.log("checker");
    if(window.location.pathname.includes("/clip/") || window.location.hostname === "clips.twitch.tv"){ //if it's a clip use clipsetup
        gob.type = "clip";
        clipsetup()
        looper();
    } else if(window.location.pathname.includes("/videos/") || window.location.pathname.includes("/video/")){ //if vod use vodsetup
        gob.type = "vod";
        vodsetup()
        looper();
    } else{
        if(document.getElementById('finderwrap') != null){(document.getElementById('finderwrap')).remove()}; //if navigating somewhere else delete finder because edgecases
        looper();
    }
}

function expressvod(){
    var target = document.querySelector(expresstarget); //building off point
    var createxv = target.parentNode.insertBefore(document.createElement('input'), target); //inserts before
    createxv.setAttribute("id", "expressvod");
    createxv.setAttribute("placeholder", "Express Vod");
    var inputbox = document.getElementById('expressvod');
    inputbox.addEventListener("keydown", (event) =>{
        if(event.defaultPrevented){return;}
        switch(event.code) {
            case "Enter": case "NumpadEnter":
            apireturnexpress(userquery(inputbox.value, 1))
            inputbox.value = "";
        }
    })
}

const apireturnexpress = async (input) => { //user input to get single video link back and open latest vod
//console.log('apiexpress')
    const a = await apifetch(input);
    if(a.user == null){return;} //if no user exit
    if(a.user.videos.edges.length === 0){return}; //if user exists but has no videos just exit
    var link =("https://twitch.tv/videos/").concat(a.user.videos.edges[0].node.id);
    window.open(link, "_blank");
};

//gql queries //moreinformation here https://supersonichub1.github.io/twitch-graphql-api/
function videoquery(input){ //video id input gets video info back
    const videoq =(
      `query {
        video(id: ${input}) {
              createdAt
              lengthSeconds
              id
              broadcastType
        }
      }`);
      return videoq
}

function userquery(input,ninput){ //twitch name input gets videos back ninput is number of videos you want
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
      }
    }`);
    return userq;
}

function clipquery(input){ //clip slug input and gets clip info back
    const clipq =(
      `query {
        clip(slug: "${input}") {
            createdAt
            durationSeconds
            videoOffsetSeconds
            video{
              id
              createdAt
            }
        }
        }`)
    return clipq;
};

// using gql api that is not supported by twitch but helix is pain in my asshole
const apifetch = async (input) => {
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

const apireturnv = async (input) => { //video information api call
    const a = await apifetch(input);
    if(a.video === null){
        document.getElementById('infodiv').innerText = "API didn't return vod info. If this problem persists contact dev->@SpaceshipCapt"
        document.getElementById('infodiv').style.color = "#D68029";
    }
    if(a.video.broadcastType != "ARCHIVE" && a.video.broadcastType != null){
        document.getElementById('infodiv').innerText = "This is not a vod. Looking Glass will not function properly."
        document.getElementById('infodiv').style.color = "#D68029";
        gob.vstime = 804643200 //this is just to have an old starttime to not confuse user
    }
    else{
        gob.vstime = Date.parse(a.video.createdAt)/1000 //start time of vod
    }
};

const apireturnc = async (input) => { //clip information api call
    const a = await apifetch(input);
    if(a.clip.video != null){
        gob.stime = (Date.parse(a.clip.video.createdAt)/1000)+a.clip.videoOffsetSeconds //gets clips parent vod creation time and adds clip offset to get absolute time of clip
    }
    else{
        gob.stime =  (Date.parse(a.clip.createdAt)/1000)-30
        document.getElementById('infodiv').innerText = "Clip doesn't have a vod; links generated can be wildly innaccurate if this clip wasn't created during a live broadcast."
        document.getElementById('infodiv').style.color = "#D68029";
    }
};

const apireturnu = async (input) => { //user input to get list of videos api call
    const a = await apifetch(input);
    if(a.user == null){document.getElementById('infodiv').innerText = "Invalid Twitch Name. Try Again."; return;}
    if(a.user.videos.edges.length === 0){
        document.getElementById('infodiv').innerText = `User has no vods.`;
        document.getElementById('infodiv').style.color = "gray";
        return
    }
    document.getElementById('infodiv').style.color = "white";
    gob.varray = a.user.videos.edges;
    arrayvods()
};

function boxcreate(qselector){
//console.log('boxcreate')
    var target = document.querySelector(qselector)
    var cdiv = document.createElement('div') 
    var created = target.parentNode.insertBefore(cdiv, target)
    created.setAttribute("id", "finderwrap");
    created.setAttribute("class",  window.location.pathname.substring(window.location.pathname.lastIndexOf("/") + 1));
//above creates a class with url pathname select this with document.querySelector("#finderwrap").classList[0]
    var top = document.getElementById('finderwrap').appendChild(document.createElement('div'))
    top.setAttribute("id", "topd")
    var bot = document.getElementById('finderwrap').appendChild(document.createElement('div'))
    bot.setAttribute("id", "botd")

    var createind = document.getElementById('topd').appendChild(document.createElement('div'))
    createind.setAttribute("id", "ind")

    var createp = document.getElementById('ind').appendChild(document.createElement('input'))
    createp.setAttribute("id", "targetid")
    createp.setAttribute("placeholder", "Channel Name")

    submitb = document.getElementById('topd').appendChild(document.createElement('button'))
    submitb.setAttribute("id", "submitb")
    sbutton = document.getElementById('submitb').appendChild(document.createElement('div'))
    sbutton.setAttribute("id", "plusbutton")
    sbutton.innerText = "(+)"
    
    var createinfod = document.getElementById('topd').appendChild(document.createElement('div'))
    createinfod.setAttribute("id", "infodiv")
    createinfod.innerText = "Enter name to search vods. Ctrl+Enter to instantly open links.";
//event listeners for submitting names
    var evel = document.getElementById('targetid')
    evel.addEventListener("keydown", (event) =>{
        if(event.defaultPrevented){return;}
        switch(event.code) {
            case "Enter": case "NumpadEnter":
            gob.ctrlstate = event.getModifierState("Control") //true if control is held down during enter press false if isn't held down
            start();
        }
        })
    submitb.addEventListener("click", (event) =>{
            start();
    })
}

function clipsetup(){
//console.log('clipsetup');
    inputed = []; //resets the inputs for rare cases
    if(window.location.hostname == "clips.twitch.tv"){//clips.twitch.tv/blahdbladhbladh view
        boxcreate(clipsdot);
    }; 
    if(window.location.hostname == "www.twitch.tv"){ //channel clips view eg twitch.tv/moonmoon/clips/blahblahblah
        boxcreate(slashclips);
    };
    apireturnc(clipquery(window.location.pathname.substring(window.location.pathname.lastIndexOf("/") + 1))); 
} 

function vodsetup(){
//console.log('vodsetup');
    inputed = []; //resets the inputs for rare cases
    boxcreate(slashvideos);
    apireturnv(videoquery(window.location.pathname.substring(window.location.pathname.lastIndexOf("/") + 1)))
}
function start(){
//console.log('start')
    var rawname = getinput();
    if(rawname == null){return} //stops if name is a repeat
    if (gob.type === "vod"){
        var voffset = gob.vstime;
        var rawtime = (document.body.querySelector(playertime).innerText);
        voffset += ((parseInt(rawtime.split(':')[0]))*60)*60; //adds hours in seconds to offset
        voffset += (parseInt(rawtime.split(':')[1]))*60;    // adds minutes in seconds to offset
        voffset += parseInt(rawtime.split(':')[2]);     //adds seconds to offset
        gob.stime= voffset;
        var namet = rawname.concat(" "+rawtime)
    };
    if (gob.type === "clip"){var namet = rawname}
    inputed.push(namet);
    apireturnu(userquery(rawname, 100));
}

function inputedtest(current){ //input name and returns true if contained within array already
    for(var i = 0; i < inputed.length; i++){
        if(current === inputed[i]){return true}
    }
    return false;
}

function getinput(){
    var iname =  (document.getElementById('targetid').value).replace(/\W/g, '');//clears the input of non alphanumeric characters
    if(iname === ""){document.getElementById('infodiv').innerText = "Empty input. Enter name.";return};
    if(inputedtest(iname) === true){document.getElementById('infodiv').innerText = "Repeat entry.";return};
    if(gob.type === "vod"){
        if(inputedtest(iname.concat(" "+document.body.querySelector(playertime).innerText)) === true){document.getElementById('infodiv').innerText = "Repeat entry.";return}
    }
    document.getElementById('targetid').value = ""; //clears input box
    return iname;
}

function arrayvods(){
//console.log('arrayvods')
    var vodstart = [];
    var vodend = [];
    for(var i = 0; i < gob.varray.length; i++){ //gets start and end times of inputed user's last 100 vods
        var c = (Date.parse(new Date(gob.varray[i].node.createdAt))/1000)
        vodstart.push(c) //array of vod starts in seconds
        vodend.push(c+(gob.varray[i].node.lengthSeconds)) //adds vod  length to get end time
    }
    if(gob.stime < vodstart[vodstart.length-1]){
        gob.color = "gray";
        document.getElementById('infodiv').innerText = `Searched ${gob.varray.length} vod(s) and this is older than all of them`;
        cl();
        return 
    }
    else{
        for(var i = 0;i < vodstart.length; i++){
            if(gob.stime > vodstart[i] && gob.stime < vodend[i]){
                var ts = secondsCalc(gob.stime-vodstart[i])
                gob.link = ("https://twitch.tv/videos/").concat((gob.varray[i].node.id).concat("?t=")).concat(ts)
                gob.color="green";
                cl();
                document.getElementById('infodiv').innerText = `${gob.varray.length} vod(s) and this was found ${i+1} vod(s) ago!`
                return 
            }
        }
        gob.color="red";
        gob.link = "novod";
        cl();
        document.getElementById('infodiv').innerText = `${gob.varray.length} vod(s) and this timestamp wasn't found in any of them.`;
    }
}

function secondsCalc(d) {
    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    var hDisplay = h > 0 ? h + "h" : "";
    var mDisplay = m > 0 ? m + "m" : "";
    var sDisplay = s > 0 ? s + "s" : "";
    return hDisplay + mDisplay + sDisplay; 
}

function cl(){ //create link
    var ce = document.getElementById('botd').appendChild(document.createElement('div'))
    ce.setAttribute("class","ce")
    ce.setAttribute("id",`${inputed[inputed.length-1]}`);
        if(gob.color === "green"){
        ce.setAttribute("onclick", `window.open('${gob.link}', "_blank")`);
        if(gob.ctrlstate === true){window.open(gob.link, "_blank");}
        }
    var cn = document.getElementById(`${inputed[inputed.length-1]}`).appendChild(document.createElement('p'));
    cn.setAttribute("class", "plink")
    cn.innerText = `${(inputed[inputed.length-1]).toUpperCase()}`;
    if(gob.color === "green"){(ce.style.background = "#05483F") && (ce.style.cursor='pointer')}; 
    if(gob.color === "red"){(ce.style.background = "#7F0423") && (ce.style.cursor='not-allowed')}; 
    if(gob.color === "gray"){(ce.style.background = "#505050") && (ce.style.cursor='not-allowed')}; 
}