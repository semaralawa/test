var localVideo;
var localStream;
var remoteVideo;
var remoteStream;
var peerConnection;
var uuid;
var serverConnection;
var movement_result;

var peerConnectionConfig = {
  'iceServers': [
    { 'urls': 'stun:stun.stunprotocol.org:3478' },
    { 'urls': 'stun:stun.l.google.com:19302' },
    { 'urls': 'stun:relay.backups.cz' },
    {
      url: 'turn:relay.backups.cz',
      credential: 'webrtc',
      username: 'webrtc'
    },
    {
      url: 'turn:relay.backups.cz?transport=tcp',
      credential: 'webrtc',
      username: 'webrtc'
    }
  ]
};

function pageReady() {
  uuid = createUUID();

  localVideo = document.getElementById('localVideo');
  remoteVideo = document.getElementById('remoteVideo');
  movement_result = document.getElementById('result');
  address = window.location.hostname;

  //use this if you want to add some domain
  // if (address.includes('localhost')) {
  //   serverConnection = new WebSocket('wss://' + address + ':8443');
  // }
  // else {
  //   serverConnection = new WebSocket('wss://' + window.location.hostname);
  // }

  //use this if you only use public IP
  //also comment this if you use code above it
  serverConnection = new WebSocket('wss://' + address + ':8443');

  serverConnection.onmessage = gotMessageFromServer;

  var constraints = {
    video: { width: 1080, height: 633 },
    audio: true,
  };

  if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia(constraints).then(getUserMediaSuccess).catch(errorHandler);
  } else {
    alert('Your browser does not support getUserMedia API');
  }
}

function button_click(element) {
  serverConnection.send(JSON.stringify({ 'movement': element.id }));
  movement_result.innerHTML = element.id;
}

function getUserMediaSuccess(stream) {
  localStream = stream;
  localVideo.srcObject = stream;

  remoteStream = new MediaStream();
}

function start(isCaller) {
  peerConnection = new RTCPeerConnection(peerConnectionConfig);
  peerConnection.onicecandidate = gotIceCandidate;
  peerConnection.ontrack = gotRemoteStream;
  peerConnection.addStream(localStream);

  if (isCaller) {
    peerConnection.createOffer().then(createdDescription).catch(errorHandler);
  }
}

function gotMessageFromServer(message) {
  if (!peerConnection) start(false);

  var signal = JSON.parse(message.data);

  // Ignore messages from ourself
  if (signal.uuid == uuid) return;

  if (signal.sdp) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function () {
      // Only create answers in response to offers
      if (signal.sdp.type == 'offer') {
        peerConnection.createAnswer().then(createdDescription).catch(errorHandler);
      }
    }).catch(errorHandler);
  } else if (signal.ice) {
    peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
  }
}

function gotIceCandidate(event) {
  if (event.candidate != null) {
    serverConnection.send(JSON.stringify({ 'ice': event.candidate, 'uuid': uuid }));
  }
}

function createdDescription(description) {
  console.log('got description');

  peerConnection.setLocalDescription(description).then(function () {
    serverConnection.send(JSON.stringify({ 'sdp': peerConnection.localDescription, 'uuid': uuid }));
  }).catch(errorHandler);
}

function gotRemoteStream(event) {
  console.log('got remote stream');
  event.streams[0].getTracks().forEach((track) => {
    remoteStream.addTrack(track);
  });
  remoteVideo.srcObject = remoteStream;
}

function errorHandler(error) {
  console.log(error);
}

// Taken from http://stackoverflow.com/a/105074/515584
// Strictly speaking, it's not a real UUID, but it gets the job done here
function createUUID() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
