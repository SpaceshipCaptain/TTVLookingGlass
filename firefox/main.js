console.log('ttvlookingGlass extension initiated') //testing
let gob = {};
var inputed = [];
let lasturl;
window.onload=() =>{ //console.log("onload");
    setTimeout(() => {checker()}, 2000)}

function boxcreate(){
    //console.log('boxcreate')
    var createind = document.getElementById('topd').appendChild(document.createElement('div'));
    createind.setAttribute("id", "ind");

    createp = document.getElementById('ind').appendChild(document.createElement('input'));
    createp.setAttribute("id", "targetid");
    createp.setAttribute("placeholder", "Channel Name");

    submitb = document.getElementById('topd').appendChild(document.createElement('button'));
    submitb.setAttribute("id", "submitb");
    sbutton = document.getElementById('submitb').appendChild(document.createElement('div'));
    sbutton.setAttribute("id", "plusbutton");
    sbutton.innerText = "(+)";
    
    createinfod = document.getElementById('topd').appendChild(document.createElement('div'));
    createinfod.setAttribute("id", "infodiv");
    createinfod.innerText = "Submit a name to get their perspective.";
}

function clipcreate(){
    //console.log('clipcreate')
    if(!document.getElementById('finderWrap') === false){(document.getElementById('finderWrap')).remove()}; //if the input div already exists delete it
    inputed = []; //resets the inputs for rare cases
    if(window.location.hostname == "clips.twitch.tv"){//clips.twitch.tv/blahdbladhbladh view
        var tar = document.querySelector("div.Layout-sc-nxg1ff-0.eYftuF")
        var cslug = window.location.pathname.substring(window.location.pathname.lastIndexOf("/") + 1)
    }; 
    if(window.location.hostname == "www.twitch.tv"){ //channel clips view eg twitch.tv/moonmoon/clips/blahblahblah
        var tar = document.querySelector("div.metadata-layout__split-top")
        var cslug = window.location.pathname.substring(window.location.pathname.lastIndexOf("/") + 1)
    }; 
    let cdiv = document.createElement('div')
    var created = tar.parentNode.insertBefore(cdiv, tar.nextSibling)
    created.setAttribute("id", "finderWrap");
    created.style.background = "#0e0e10";
    var top = document.getElementById('finderWrap').appendChild(document.createElement('div'))
    top.setAttribute("id", "topd")
    var bot = document.getElementById('finderWrap').appendChild(document.createElement('div'))
    bot.setAttribute("id", "botd")
    boxcreate();

    let evel = document.getElementById('targetid')
    evel.addEventListener("keydown", (event) =>{
        if(event.defaultPrevented){return;}

        switch(event.code) {
            case "Enter": case "NumpadEnter":
            start();
        }
        })
    submitb.addEventListener("click", (event) =>{
            start();
    })
    let init = async(cslug) => {
        gob.cinfo = await clipInfo(cslug);
        getctime();
    }    
    init(cslug);
}

function checker(){
    //console.log("checker");
    lasturl = window.location.href;
    if(window.location.pathname.includes("/clip/") || window.location.hostname === "clips.twitch.tv"){
        gob.type = "clip";
        setTimeout(() => {clipcreate()},500)
        looper();
    } else if(window.location.pathname.includes("/videos/") || window.location.pathname.includes("/video/")){
        gob.type = "vod";
        setTimeout(() => {vodcreate()},500);
        looper();
    } else{
        if(!document.getElementById('finderWrap') === false){(document.getElementById('finderWrap')).remove()};
        if(!document.getElementById('vodFinder') === false){(document.getElementById('vodFinder')).remove()};
        looper();
    }
}
async function looper() {
    //console.log("looper")
    setTimeout(() => {
        if (lasturl === window.location.href){ //if the url has not changed don't do anything
            looper();
        }
        else{ //if the url has changed check it and maybe do stuff
            checker();
    }
    }, 3000);
}

let start = async () =>{
    var rawname = getinput();
    if (gob.type === "vod"){var namet = rawname.concat(" "+gob.vodtime)};
    if (gob.type === "clip"){var namet = rawname}
    if(rawname === ""){document.getElementById('infodiv').innerText = "Empty input. Enter name.";return}; //no blank input
    if(inputedtest(namet) === true){document.getElementById('infodiv').innerText = "Repeat entry.";return}; //checks for repeat inputs
    inputed.push(namet);
    var gid = await getid(rawname);
    if(gid == null){return;} //checks if name is a twich user
    gob.varray = await getvods(gid);
    arrayvods();
}

function inputedtest(current){ //input name and returns true if contained within array already
    for(var i = 0; i < inputed.length; i++){
        if(current === inputed[i]){return true}
    }
    return false;
}

function getctime(){
    if(gob.cinfo.vod == null){ //if clip has no vod uses the less reliable created at. If someone creates a clip from a old vod, this method can be months off but usually works
        gob.start = ((Date.parse(new Date(gob.cinfo.created_at)))/1000)-30 
        document.getElementById('infodiv').innerText = "Clip doesn't have a vod, links generated can be wildly innaccurate if this clip wasn't created during a live broadcast."
        document.getElementById('infodiv').style.color = "#D68029";
        //console.log('This clip does not have a vod but trying');
    }
    else{
        getcliptime();
    }
}
let getcliptime = async () => {
    cvod = await vidInfo(gob.cinfo.vod.id)
    gob.start = ((Date.parse(new Date(cvod.created_at)))/1000)+gob.cinfo.vod.offset; //gets the time that the vod started and adds the offset of when the clip happens
}

function getinput(){
    iname =  (createp.value).replace(/\W/g, '');//clears the input of non-alphanumeric characters
    createp.value = ""; //clears input box
    return iname;
}

let twitchapi = async (call) =>{
    //console.log('twitchapi')
    const response = await fetch(`https://api.twitch.tv/kraken/${call}`, {
        headers: {
            Accept: 'application/vnd.twitchtv.v5+json',
            'Client-ID': 'zs377ogpzz01ogfx26pvbddx9jodg1',
        },
    })
    var data = await response.json();
    return data
}

let getid = async (name) =>{
    //console.log('getid')
    var urle = `users?login=${name}`
    try {
        var channelinfo = await twitchapi(urle)
        if(channelinfo.users.length === 0){document.getElementById('infodiv').innerText = "Twitch user doesn't exist"; return;} //fix this
        var id = channelinfo.users[0]._id;
        return id;
    } catch(error) {
        console.log(error)
    }
    
}

let getvods = async (id) =>{
    //console.log('getvods');
    var urle = `channels/${id}/videos?limit=100&broadcast_type=archive`;
    try {
         var vods = (await twitchapi(urle)).videos;
         return vods;
    } catch(error) {
        console.log(error)
    }
}

let vidInfo = async (slug) =>{
    //console.log('vidInfo');
    var urle = `videos/${slug}`
    try {
        var vinfo = await twitchapi(urle)
        return vinfo;
    } catch(error) {
        console.log(error)
    }
}

let clipInfo = async (slug) =>{
    //console.log('clipInfo');
    var urle = `clips/${slug}`
    try {
        var info = await twitchapi(urle)
        return info;
    } catch(error) {
        console.log(error);
    }
}

function secondsCalc(d) {
    //console.log('secondsCalc')
    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    var hDisplay = h > 0 ? h + "h" : "";
    var mDisplay = m > 0 ? m + "m" : "";
    var sDisplay = s > 0 ? s + "s" : "";
    return hDisplay + mDisplay + sDisplay; 
}

function arrayvods(){
    //console.log('arrayvods')
    var vodstart = [];
    var vodend = [];
    for(var i = 0; i < gob.varray.length; i++){ //gets start and end times of inputed user's last 100 vods
        var c = (Date.parse(new Date(gob.varray[i].published_at))/1000)
        vodstart.push(c) //array of vod starts in seconds
        vodend.push(c+(gob.varray[i].length)) //adds vod  length to get end time
    }
    if(gob.start < vodstart[vodstart.length-1]){
        gob.color = "gray";
        document.getElementById('infodiv').innerText = `Searched ${gob.varray.length} vods and this is older than all of them`;
        cl();
        return 
    }
    else{
        for(var i = 0;i < vodstart.length; i++){
            if(gob.start > vodstart[i] && gob.start < vodend[i]){
                var ts = secondsCalc(gob.start-vodstart[i])
                gob.link = ((gob.varray[i].url).concat("?t=")).concat(ts)
                gob.color="green";
                cl();
                document.getElementById('infodiv').innerText = `${gob.varray.length} vods and this was found ${i+1} vods ago!`
                return //console.log(gob.link)
            }
        }
        gob.color="red";
        gob.link = "novod";
        cl();
        document.getElementById('infodiv').innerText = `${gob.varray.length} vods and this timestamp wasn't found in any of them.`;
    }
}

function cl(){ //create link
    var ce = document.getElementById('botd').appendChild(document.createElement('div'))
    ce.setAttribute("class","ce")
    ce.setAttribute("id",`${inputed[inputed.length-1]}`);
        if(gob.color === "green"){
        ce.setAttribute("onclick", `window.open('${gob.link}', "_blank")`);
        }
    var cn = document.getElementById(`${inputed[inputed.length-1]}`).appendChild(document.createElement('p'));
    cn.setAttribute("class", "plink")
    cn.innerText = `${(inputed[inputed.length-1]).toUpperCase()}`;
    if(gob.color === "green"){(ce.style.background = "#05483F") && (ce.style.cursor='pointer')}; 
    if(gob.color === "red"){(ce.style.background = "#7F0423") && (ce.style.cursor='not-allowed')}; 
    if(gob.color === "gray"){(ce.style.background = "#505050") && (ce.style.cursor='not-allowed')}; 
}

function vodcreate(){
    //console.log('vodcreate')
    if(!document.getElementById('vodFinder') === false){(document.getElementById('vodFinder')).remove()}; //if the input div already exists delete it
    inputed = []; //removes inputs for rare cases
    gob.vslug = window.location.pathname.substring(window.location.pathname.lastIndexOf("/") + 1) //sets vslug to the video code
    var tar = document.querySelector("div.metadata-layout__split-top")
    let cdiv = document.createElement('div')
    var created = tar.parentNode.insertBefore(cdiv, tar.nextSibling) //this is insert after workaround to help loading
    created.setAttribute("id", "vodFinder");
    created.style.background = "#0e0e10";
    var top = document.getElementById('vodFinder').appendChild(document.createElement('div'))
    top.setAttribute("id", "topd") 
    var bot = document.getElementById('vodFinder').appendChild(document.createElement('div'))
    bot.setAttribute("id", "botd")
    boxcreate();

    let evel = document.getElementById('targetid')
    evel.addEventListener("keydown", (event) =>{
        if(event.defaultPrevented){return;}

        switch(event.code) {
            case "Enter": case "NumpadEnter":
            vodstart();
        }
        })
    submitb.addEventListener("click", (event) =>{
            vodstart(); 
    })
    getvodinfo();
}

let getvodinfo = async () =>{ //sets info about the vod on page
    vodid = window.location.pathname.substring(window.location.pathname.lastIndexOf("/")+1)
    gob.vodinfo = await vidInfo(vodid);
}

let vodstart = async () =>{
    gob.vodtime = (document.body.querySelector('.CoreText-sc-cpl358-0.QsoSQ[data-a-target="player-seekbar-current-time"]').innerText);
    var vstart = (Date.parse(new Date(gob.vodinfo.created_at)))/1000
    var voffset = 0;
    voffset += ((parseInt(gob.vodtime.split(':')[0]))*60)*60; //adds hours in seconds to offset
    voffset += (parseInt(gob.vodtime.split(':')[1]))*60;    // adds minutes in seconds to offset
    voffset += parseInt(gob.vodtime.split(':')[2]);     //adds seconds to offset
    gob.start= vstart + voffset;
    start();
}