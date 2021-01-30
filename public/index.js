function onLoad() {
  // create Agora client
  const client = AgoraRTC.createClient({mode: "rtc", codec: "vp8"});

  const localTracks = {
    videoTrack: null,
    audioTrack: null
  };
  let remoteUsers = {};
  // Agora client options
  const options = {
    appid: 'YOUR_APP_ID',
  };
  // add event listeners
  document.getElementById('join-form')
    .addEventListener('submit', async function(e) {
      e.preventDefault();
      document.getElementById('join').setAttribute("disabled", "");
      try {
        await join();
        document.getElementById('success-alert').classList.add("show");
      } catch (error) {
        console.error(error);
      } finally {
        document.getElementById('leave').removeAttribute("disabled");
      }
    });

  document.getElementById('leave').addEventListener("click", leave);
  document.getElementById('alert-close').addEventListener("click", function(e) {
    document.getElementById('success-alert').classList.remove("show");
  });



  async function join() {
    // add event listener to play remote tracks when remote user publishs.
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);

    let uid
    const channelName = 'hoge3';
    const token = await getToken(channelName);
    // join a channel and create local tracks, we can use Promise.all to run them concurrently
    [uid, localTracks.audioTrack, localTracks.videoTrack] = await Promise.all([
      // join the channel
      client.join(options.appid, channelName, token),
      // create local tracks, using microphone and camera
      AgoraRTC.createMicrophoneAudioTrack(),
      AgoraRTC.createCameraVideoTrack(),
      //AgoraRTC.createScreenVideoTrack()
    ]);

    // play local video track
    localTracks.videoTrack.play("local-player");
    document.getElementById("local-player-name").textContent = `localVideo(${uid})`;

    // publish local tracks to channel
    await client.publish(Object.values(localTracks));
    console.log("publish success");
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

  function handleUserUnpublished(user) {
    const id = user.uid;
    delete remoteUsers[id];
    const element = document.getElementById(`player-wrapper-${id}`);
    if (element) {
      element.remove()
    }
  }
}
window.onload = onLoad;
