console.log('TTVLookingGlass Extension Initiated. Created by @SpaceshipCapt')
//chrome 

var ctrlstate //for opening links immediately

//target query divs for extention embed
const clipsdot = "div.Layout-sc-1xcs6mc-0.giKQhB"; //clips.twitch.tv selects div below and inserts above
const slashvideos = "div.Layout-sc-1xcs6mc-0.haGrcr"; //twitch.tv/video/numbers selects div below and inserts above and //twitch.tv/moonmoon/clips
const playertime = '.CoreText-sc-1txzju1-0.ckwzla[data-a-target="player-seekbar-current-time"]'; //.innertext of this selects the current vod time
const expresstarget = 'div.Layout-sc-1xcs6mc-0.czRfnU.top-nav__prime'; //express vod target left of prime loot crown

//on load start looping
window.onload=() =>{ 
   looper()};

function looper() {
//console.log("looper")
    setTimeout(() => {
        if(document.querySelector(expresstarget) != null && (document.getElementById('expressvod'))=== null){ //checks to see if element is there and then generates if it isn't
                expressvod();}
        if((document.querySelector(clipsdot) || document.querySelector(slashvideos) != null)){ //checks if any of the selectors are on page
            if(document.getElementById('finderwrap') != null && (document.querySelector("#finderwrap").classList[0] != window.location.pathname.substring(window.location.pathname.lastIndexOf("/") + 1))){
                document.getElementById('finderwrap').remove()} //checks if box exists and if the box class does not match url it removes the box
            if(document.getElementById('finderwrap') === null){
                urlchecker();} //if the box does not exist check url and probably create one
            else{looper();}
        }
        else{looper();}
    }, 1500);
}

function urlchecker(){
//console.log("checker");
    if(window.location.pathname.includes("/clip/") || window.location.hostname === "clips.twitch.tv"){ //if it's a clip use clipsetup
        clipsetup();
        looper();
    } else if(window.location.pathname.includes("/videos/") || window.location.pathname.includes("/video/")){ //if vod use vodsetup
        vodsetup();
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

// using gql api that is not supported by twitch but helix is pain
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
        document.getElementById('finderwrap').setAttribute('data-time', 804643200) //this is just to have an old starttime to not confuse user
    }
    else{
        document.getElementById('finderwrap').setAttribute('data-time', Date.parse(a.video.createdAt)/1000); //start time of vod
    }
};

const apireturnc = async (input) => { //clip information api call
    const a = await apifetch(input);
    if(a.clip.video != null){
        document.getElementById('finderwrap').setAttribute('data-time', (Date.parse(a.clip.video.createdAt)/1000)+a.clip.videoOffsetSeconds) //gets clips parent vod creation time and adds clip offset to get absolute time of clip
    }
    else{
        document.getElementById('finderwrap').setAttribute('data-time', (Date.parse(a.clip.createdAt)/1000)-30)
        document.getElementById('infodiv').innerText = "Clip doesn't have a vod; links generated can be wildly innaccurate if this clip wasn't created during a live broadcast."
        document.getElementById('infodiv').style.color = "#D68029";
    }
};

const apireturnu = async (input,name) => { //user input to get list of videos api call
    const a = await apifetch(input);
    if(a.user == null){document.getElementById('infodiv').innerText = "Invalid Twitch Name. Try Again."; return;}
    if(a.user.videos.edges.length === 0){
        document.getElementById('infodiv').innerText = `User has no vods.`;
        document.getElementById('infodiv').style.color = "gray";
        return
    }
    document.getElementById('infodiv').style.color = "white";
    const varray = a.user.videos.edges;
    arrayvods(varray,name)
};

function boxcreate(qselector, type){
//console.log('boxcreate')
    var target = document.querySelector(qselector)
    var cdiv = document.createElement('div') 
    var created = target.parentNode.insertBefore(cdiv, target)
    created.setAttribute("id", "finderwrap");
    created.setAttribute("data-type", type)
    created.setAttribute("data-time", "0")
    created.setAttribute("data-offset", "0")
    created.setAttribute("class",  window.location.pathname.substring(window.location.pathname.lastIndexOf("/") + 1));
//above creates a class with url pathname select this with document.querySelector("#finderwrap").classList[0]
    var top = document.getElementById('finderwrap').appendChild(document.createElement('div'))
    top.setAttribute("id", "topd")
    var bot = document.getElementById('finderwrap').appendChild(document.createElement('div'))
    bot.setAttribute("id", "botd")
    bot.addEventListener("contextmenu", function(event) { //this just prevents context menu from popping up if you misRclick around bubbles
        event.preventDefault();
    });

    var createind = document.getElementById('topd').appendChild(document.createElement('div'))
    createind.setAttribute("id", "ind")

    var createp = document.getElementById('ind').appendChild(document.createElement('input'))
    createp.setAttribute("id", "targetid")
    createp.setAttribute("placeholder", "Channel Name")
    
    var createinfod = document.getElementById('topd').appendChild(document.createElement('div'))
    createinfod.setAttribute("id", "infodiv")
    createinfod.innerText = "Enter name to search vods. Ctrl+Enter to instantly open links.";

//event listener for submitting names
    var evel = document.getElementById('targetid')
    evel.addEventListener("keydown", (event) =>{
        if(event.defaultPrevented){return;}
        switch(event.code) {
            case "Enter": case "NumpadEnter":
            ctrlstate = event.getModifierState("Control") //true if control is held down during enter press false if isn't held down
            start();
        }
        })
}

function clipsetup(){
//console.log('clipsetup');
    const type = "clip";
    if(window.location.hostname == "clips.twitch.tv"){//clips.twitch.tv/blahdbladhbladh view
        boxcreate(clipsdot, type);
    }; 
    if(window.location.hostname == "www.twitch.tv"){ //channel clips view eg twitch.tv/moonmoon/clips/blahblahblah
        boxcreate(slashvideos, type);
    };
    apireturnc(clipquery(window.location.pathname.substring(window.location.pathname.lastIndexOf("/") + 1))); 
} 

function vodsetup(){
//console.log('vodsetup');
    const type = "vod"
    boxcreate(slashvideos, type);
    apireturnv(videoquery(window.location.pathname.substring(window.location.pathname.lastIndexOf("/") + 1)))
}
function start(){
//console.log('start')
    var rawname = getinput();
    if(rawname == null){return} //stops if name is a repeat
    if (document.getElementById('finderwrap').getAttribute('data-type') === "vod"){
        document.getElementById('finderwrap').setAttribute('data-offset', cleanTime(document.body.querySelector(playertime).innerText)); //get seconds back
        var namet = secondsCalc(0).concat(" "+rawname)
    };
    if (document.getElementById('finderwrap').getAttribute('data-type') === "clip"){var namet = rawname}
    apireturnu(userquery(rawname, 100),rawname);
}

function getinput(){
    var iname =  (document.getElementById('targetid').value).replace(/\W/g, '');//clears the input of non alphanumeric characters
    if(iname === ""){document.getElementById('infodiv').innerText = "Empty input. Enter name.";return};
    document.getElementById('targetid').value = ""; //clears input box
    return iname;
}

function arrayvods(varray, name){
//console.log('arrayvods')
    var vodstart = [];
    var vodend = [];
    const time = parseInt(document.getElementById('finderwrap').getAttribute('data-time')); //these are here just for readability
    const offset = parseInt(document.getElementById('finderwrap').getAttribute('data-offset'));
    const stime = time+offset;
    for(var i = 0; i < varray.length; i++){ //gets start and end times of inputed user's last 100 vods
        var c = (Date.parse(new Date(varray[i].node.createdAt))/1000)
        vodstart.push(c) //array of vod starts in seconds
        vodend.push(c+(varray[i].node.lengthSeconds)) //adds vod  length to get end time
    }
    if(stime < vodstart[vodstart.length-1]){
        var color = "gray";
        document.getElementById('infodiv').innerText = `Searched ${varray.length} vod(s) and this is older than all of them. Rclick to remove bubble.`;
        cl(link, color, name);
        return 
    }
    else{
        for(var i = 0;i < vodstart.length; i++){
            if(stime > vodstart[i] && stime < vodend[i]){
                var ts = secondsCalc(stime-vodstart[i])
                const link = ("https://twitch.tv/videos/").concat((varray[i].node.id).concat("?t=")).concat(ts)
                var color="green";
                cl(link, color, name);
                document.getElementById('infodiv').innerText = `${varray.length} vod(s) and this was found ${i+1} vod(s) ago! Rclick bubble for details.`
                return 
            }
        }
        var color="red";
        var link = "novod";
        cl(link, color, name);
        document.getElementById('infodiv').innerText = `${varray.length} vod(s) and this timestamp wasn't found in any of them. Rclick to remove bubble.`;
    }
}

function secondsCalc(d) { //input seconds get out 1h2m3s
    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    var hDisplay = h > 0 ? h + "h" : "";
    var mDisplay = m > 0 ? m + "m" : "";
    var sDisplay = s > 0 ? s + "s" : "";
    return hDisplay + mDisplay + sDisplay; 
}

function cleanTime(time){ //input example 00:46:12 takes raw vod time and cleans it to 46m12s
    var timeA = time.split(":");
    var seconds = parseInt(timeA[2]);
    seconds += (parseInt(timeA[0])*60+parseInt(timeA[1]))*60
    return seconds;
}

function cl(link, color, name){ //create link
    var ce = document.getElementById('botd').appendChild(document.createElement('div'))
    ce.setAttribute("class","ce")
        if(color === "green"){
        re = /([^\=]+$)/; //regex to get time after last = for next line
        ce.setAttribute("data-title", "@".concat(re.exec(link)[0])); //sets the target vod time to data-title for hover display
        ce.setAttribute("data-title2", link);
        ce.setAttribute("data-title3", secondsCalc(parseInt(document.getElementById('finderwrap').getAttribute('data-offset')))+"-->");
        ce.addEventListener("click", function() {
            window.open(ce.dataset.title2, "_blank")
        })
        ce.addEventListener("contextmenu", function(event) {
            event.preventDefault();
            ce.classList.toggle("active");
            cn.classList.toggle("active");
            close.classList.toggle("active");
          });
          
        if(ctrlstate === true){window.open(link, "_blank");}
        }
    const cn = ce.appendChild(document.createElement('p'));
    cn.setAttribute("class", "plink")
    cn.innerText = name.toUpperCase();
    const close = document.getElementById('botd').appendChild(document.createElement('div'))
    close.setAttribute("class", "clink")
    close.innerText = "❌";
    close.addEventListener("click", function() {
        if (close.classList.contains('active')){
            ce.remove()+close.remove();
            document.getElementById('infodiv').innerText = "Enter name to search vods. Ctrl+Enter to instantly open links.";
        }
    })
    if(color === "green"){(ce.style.background = "#05483F") && (ce.style.cursor='pointer')}; 
    if(color === "red"){(ce.style.background = "#7F0423") && (ce.style.cursor='default')}; 
    if(color === "gray"){(ce.style.background = "#505050") && (ce.style.cursor='default')};
    if(color ==="red" || color ==="gray"){
        ce.addEventListener("contextmenu", function(event) {
            event.preventDefault();
            ce.remove();
            document.getElementById('infodiv').innerText = "Enter name to search vods. Ctrl+Enter to instantly open links.";
          });
    }
}