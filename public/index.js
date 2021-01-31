async function onLoad() {
  const socketio = io();
  let myKeys = null;
  let client = null;
  let channelName = null;
  const localTracks = {
    videoTrack: null,
    audioTrack: null
  };
  let remoteUsers = {};
  let agoraAppId = await getAppId();
  console.info(`Your agora.io appId is ${agoraAppId}`);
  // add event listeners
  document.getElementById('join-form')
    .addEventListener('submit', async function(e) {
      e.preventDefault();
      document.getElementById('join').setAttribute("disabled", "");
      try {
        myKeys = await generateKey();
        channelName = document.getElementById('channel').value;
        console.info(`APP Id is ${agoraAppId}`);
        socketio.emit('join', channelName, myKeys.base64PublicKey);
        document.getElementById('waiting-alert').classList.add("show");
      } catch (error) {
        console.error(error);
        document.getElementById('leave').removeAttribute("disabled");
      }
    });

  document.getElementById('leave').addEventListener("click", leave);
  document.querySelectorAll('.alert-close').forEach(element => {
    element.addEventListener("click", function(e) {
      e.target.closest('.alert').classList.remove("show");
    });
  });

  socketio.on("publicKey", async (data)=>{
    const { room, publicKey } = data;
    // console.log("public key: " + publicKey);
    const aesKey = await deriveKey(myKeys.privateKey, publicKey);
    // console.log("AES key: " + aesKey);
    client = AgoraRTC.createClient({mode: "rtc", codec: "vp8"});
    client.setEncryptionConfig("aes-128-xts", aesKey);
    myKeys = null;

    const uid = await join(room);
    document.getElementById("local-player-name").textContent = `localVideo(${uid})`;
    document.getElementById('success-alert').classList.add("show");
    document.getElementById('waiting-alert').classList.remove("show");
    document.getElementById('leave').removeAttribute("disabled");
  });
  socketio.on("leave", () =>{
    document.getElementById('full-alert').classList.add("show");
    document.getElementById('waiting-alert').classList.remove("show");
    document.getElementById("join").removeAttribute("disabled");
  })

  async function join(channelName) {
    if (!channelName) {
      throw new Error('channel name is required.')
    }
    // add event listener to play remote tracks when remote user publishs.
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);

    let uid
    const token = await getToken(channelName);
    console.info(`Your token is ${token}`);
    // join a channel and create local tracks, we can use Promise.all to run them concurrently
    [uid, localTracks.audioTrack, localTracks.videoTrack] = await Promise.all([
      // join the channel
      client.join(agoraAppId, channelName, token),
      // create local tracks, using microphone and camera
      AgoraRTC.createMicrophoneAudioTrack(),
      AgoraRTC.createCameraVideoTrack(),
      //AgoraRTC.createScreenVideoTrack()
    ]);

    // play local video track
    localTracks.videoTrack.play("local-player");

    // publish local tracks to channel
    await client.publish(Object.values(localTracks));
    console.log("publish success");
    return uid;
  }

  async function getAppId() {
    const response = await fetch("/appId");
    const data = await response.json();
    return data.appId;
  }
  async function getToken(channelName) {
    const response = await fetch("/rtcToken?" + new URLSearchParams({channelName}));
    const data = await response.json();
    return data.key;
  }

  async function leave() {
    for (const trackName in localTracks) {
      const track = localTracks[trackName];
      if (track) {
        track.stop();
        track.close();
        localTracks[trackName] = undefined;
      }
    }

    // remove remote users and player views
    remoteUsers = {};
    document.getElementById("remote-player-list").innerHTML = "";

    // leave the channel
    await client.leave();
    socketio.emit('leave', channelName);

    document.getElementById("local-player-name").textContent = "";
    document.getElementById("join").removeAttribute("disabled");
    document.getElementById("leave").setAttribute("disabled", "");
    document.getElementById('success-alert').classList.remove("show");
    console.log("client leaves channel success");
  }

  async function subscribe(user, mediaType) {
    const uid = user.uid;
    // subscribe to a remote user
    await client.subscribe(user, mediaType);
    console.log("subscribe success");
    if (mediaType === 'video') {
      const playerElement = document.createElement("div")
      document.getElementById("remote-player-list").append(playerElement)
      playerElement.outerHTML = `
      <div id="player-wrapper-${uid}">
        <p class="player-name">remoteUser(${uid})</p>
        <div id="player-${uid}" class="player"></div>
      </div>
    `;
      user.videoTrack.play(`player-${uid}`);
    }
    if (mediaType === 'audio') {
      user.audioTrack.play();
    }
  }

  async function handleUserPublished(user, mediaType) {
    const id = user.uid;
    remoteUsers[id] = user;
    await subscribe(user, mediaType);
  }

  async function handleUserUnpublished(user) {
    const id = user.uid;
    delete remoteUsers[id];
    const element = document.getElementById(`player-wrapper-${id}`);
    if (element) {
      element.remove()
    }
    // 現状は2人じゃないと部屋を作らない
    await leave();
  }
  async function generateKey(){
    const ec = {
      name: "ECDH",
      namedCurve: "P-521"
    };
    const usage = ["deriveKey"];
    const keys = await crypto.subtle.generateKey(ec, true, usage);
    const exportedPublicKey = await crypto.subtle.exportKey("spki", keys.publicKey);
    const base64PublicKey = btoa(String.fromCharCode.apply(null, new Uint8Array(exportedPublicKey)));
    return {
      privateKey: keys.privateKey,
      base64PublicKey: base64PublicKey
    }
  }
  async function deriveKey(myPrivateKey, otherBase64PublicKey){
    function base64ToBuffer(base64Text) {
      let binary = atob(base64Text);
      let len = binary.length;
      let bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
    async function keyImport(base64Key){
      const key = base64ToBuffer(base64Key).buffer;
      const ec = {
        name: "ECDH",
        namedCurve: "P-521"
      };
      return await crypto.subtle.importKey("spki", key, ec, false, []);
    }
    const pub = await keyImport(otherBase64PublicKey)
    const aes = {
      name: "AES-GCM",
      length: 256
    };
    const ec = {
      name: "ECDH",
      public: pub
    };
    const usage = ["encrypt", "decrypt"];
    const key = await crypto.subtle.deriveKey(ec, myPrivateKey, aes, true, usage);
    const buffer = await crypto.subtle.exportKey("raw", key);
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
  }
}
window.onload = onLoad;
