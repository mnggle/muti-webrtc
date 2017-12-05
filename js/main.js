'use strict';

var isChannelReady = false;
// var isInitiator = false;
var isStarted = false;
var localStream;
var obj = {}
var pc;
var curId;
var fromId;
var remoteStream;
var turnReady;
var isReconnect;
var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};
var video_accessed = true;
var audio_accessed = true;
var room;
var tempId;//临时ID对象
// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};


// var room = 'foo';
// Could prompt for room name:

var socket = io.connect();


var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var videoBox = document.getElementById('videos');
var hangupBtn = document.getElementById('hangupBtn');
var disableVideo = document.querySelector('#disableVideo');
var disableAudio = document.querySelector('#disableAudio');
var createRoom = document.querySelector('#createRoom');
createRoom.onclick=function(){
  room = prompt('Enter room name:');
  if (room) {
    socket.emit('create or join', room);
    console.log('Attempted to create or  join room', room);
  }
};
socket.on('join', function (room,id,numClients){
  if (numClients===1) {
  console.log('Created room' + room);
  // console.log(obj)
  }else{
    console.log('Another peer made a request to join room ' + room);
    console.log('This peer is the initiator of room ' + room + '!');
  };
  getUserMidea();
});
/////////////////////////////////////////////

socket.on('log', function(array) {
  console.log.apply(console, array);
});
////////////////////////////////////////////////
function sendMessage(message,id) {
  console.log('Client sending message: ', message);
  if (id) {
    socket.emit('message', message,id);
  }else{
    socket.emit('message', message);
  }
}
// This client receives a message
socket.on('message', function(message,id) {
  console.log('Client received message:', message);
  // console.log(message)
  if (message === 'got user media' && id) {
    maybeStart(id);
    sendMessage('back id',id);
    console.log(obj)
  } else if (message.type === 'offer') {
      // maybeStart();
      console.log(obj)
    console.log(message)
    obj[id].setRemoteDescription(new RTCSessionDescription(message));
    doAnswer(id);
  } else if (message.type === 'answer') {
    obj[id].setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate') {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    obj[id].addIceCandidate(candidate);
  }else if(message==="back id"){
    maybeStart(id);
    console.log(obj)
    doCall(id)
  }else if(message==='exit'){
    var removeNode = document.getElementById(id);
    console.log(id);
    console.log(removeNode)
    if (obj[id]&&removeNode) {
      delete obj[id]
      videoBox.removeChild(removeNode);
      console.log(videoBox)
    }
  }
});

////////////////////////////////////////////////////



disableAudio.addEventListener('click',function(){
    console.log(localStream.getAudioTracks());
    var audioTrack = localStream.getAudioTracks();
  if (audio_accessed) {
    if (audioTrack.length > 0) {
        audioTrack[0].enabled = false;
    };
    audio_accessed  = false
  }else{
    audioTrack[0].enabled = true;
    audio_accessed  = true
  }
});

disableVideo.addEventListener('click',function(){
    console.log(localStream.getVideoTracks());
    var videoTrack = localStream.getVideoTracks();
  if (video_accessed) {
    if (videoTrack.length > 0) {
        videoTrack[0].enabled = false;
        localVideo.src = window.URL.createObjectURL(localStream);
    };
    video_accessed  = false
  }else{
    videoTrack[0].enabled = true;
    video_accessed  = true
  }
});

hangupBtn.onclick = function(){
  socket.emit('leave');
  sendMessage('hangup');
  obj = {};
  localVideo.src = "";
  var allVideoTag = videoBox.childNodes;
  for (var i = allVideoTag.length - 1; i >= 0; i--) {
    if (allVideoTag[i].nodeName==="VIDEO"&&allVideoTag[i].id!='localVideo') {
      videoBox.removeChild(allVideoTag[i]);
    }
    // var audioTrack = localStream.getAudioTracks();
    // var videoTrack = localStream.getVideoTracks();
    // localStream.removeTrack(videoTrack[0]);
    // localStream.removeTrack(audioTrack[0]);
  }
};
function getUserMidea(){
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: { width: 100, height: 100 }
  })
  .then(gotStream)
  .catch(function(e) {
    alert('getUserMedia() error: ' + e.name);
  });
};
function gotStream(stream) {
  console.log('Adding local stream.');
  localVideo.src = window.URL.createObjectURL(stream);
  localStream = stream;
  sendMessage('got user media');
};
var constraints = {
  video: true
};
// console.log('Getting user media with constraints', constraints);
if (location.hostname !== 'localhost') {
  requestTurn(
    'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
  );
};
//创建RTCPeerConnection实例，并监听stream
function maybeStart(id) {
  console.log('>>>>>>> maybeStart() ');
    createPeerConnection(id);
    console.log(localStream)
    obj[id].addStream(localStream);
};

function createPeerConnection(id) {
  console.log('>>>>>> creating peer connection');
  try {
    obj[id] = new RTCPeerConnection(null);
    obj[id].onicecandidate = handleIceCandidate;
    obj[id].onaddstream = function(event){
        console.log(event)
        console.log('Remote stream added.');
        var node = document.createElement('video')
        videoBox.appendChild(node);
        node.setAttribute("id", id);
        node.setAttribute("autoplay", "autoplay");
        node.src = window.URL.createObjectURL(event.stream);
        // remoteStream = event.stream;
    };
    obj[id].onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
};
// window.onbeforeunload = function() {
//   sendMessage('bye');
// };
function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
    console.log(obj)
  }
}

// function handleRemoteStreamAdded(event) {
//   console.log(event)
//   console.log('Remote stream added.');
//   var node = document.createElement('video')
//   videoBox.appendChild(node);
//   node.setAttribute("id", event.stream.id);
//   node.setAttribute("autoplay", "autoplay");
//   node.src = window.URL.createObjectURL(event.stream);
//   // remoteStream = event.stream;
// }
function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
  // var removeNode = document.getElementById(event.stream.id);
  // console.log(event.stream.id)
  // videoBox.removeChild(removeNode);
}
function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall(id) {
  obj[id].createOffer().then(function(sessionDescription){
      obj[id].setLocalDescription(sessionDescription);
      sendMessage(sessionDescription,id);
  },handleCreateOfferError);
};
function doAnswer(id) {
  console.log('Sending answer to peer.');
  // console.log(id)
  obj[id].createAnswer().then(function(sessionDescription){
      console.log(sessionDescription)
      obj[id].setLocalDescription(sessionDescription);
      sendMessage(sessionDescription,id);
  },
    onCreateSessionDescriptionError
  );
}
function setLocalAndSendMessage(sessionDescription) {
  // Set Opus as the preferred codec in SDP if Opus is present.
  //  sessionDescription.sdp = preferOpus(sessionDescription.sdp);
  obj[fromId].setLocalDescription(sessionDescription);
  // console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription,fromId);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function requestTurn(turnURL) {
  var turnExists = false;
  for (var i in pcConfig.iceServers) {
    if (pcConfig.iceServers[i].url.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    console.log('Getting TURN server from ', turnURL);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
        console.log('Got TURN server: ', turnServer);
        pcConfig.iceServers.push({
          'url': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turnURL, true);
    xhr.send();
  }
};

// function hangup() {
//   console.log('Hanging up.');
//   stop();
//   sendMessage('bye');
// }

// function handleRemoteHangup() {
//   console.log('Session terminated.');
//   stop();
//   // isInitiator = false;
// }

// function stop() {
//   // isStarted = false;
//   // isAudioMuted = false;
//   // isVideoMuted = false;
//   obj[fromId].close();
//   obj[fromId] = null;
// }

///////////////////////////////////////////

// Set Opus as the default audio codec if it's present.
function preferOpus(sdp) {
  var sdpLines = sdp.split('\r\n');
  var mLineIndex;
  // Search for m line.
  for (var i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('m=audio') !== -1) {
      mLineIndex = i;
      break;
    }
  }
  if (mLineIndex === null) {
    return sdp;
  }

  // If Opus is available, set it as the default in m line.
  for (i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload) {
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex],
          opusPayload);
      }
      break;
    }
  }

  // Remove CN in m line and sdp.
  sdpLines = removeCN(sdpLines, mLineIndex);

  sdp = sdpLines.join('\r\n');
  return sdp;
}

function extractSdp(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec(mLine, payload) {
  var elements = mLine.split(' ');
  var newLine = [];
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) { // Format of media starts from the fourth.
      newLine[index++] = payload; // Put target payload to the first.
    }
    if (elements[i] !== payload) {
      newLine[index++] = elements[i];
    }
  }
  return newLine.join(' ');
}

// Strip CN from sdp before CN constraints is ready.
function removeCN(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length - 1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) {
        // Remove CN payload from m line.
        mLineElements.splice(cnPos, 1);
      }
      // Remove CN line in sdp
      sdpLines.splice(i, 1);
    }
  }

  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
}
