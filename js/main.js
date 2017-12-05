'use strict';

var localStream,
    obj = {},// RTCPeerConnection对象
    channelObj = {},//dataChannel对象
    remoteStream,
    turnReady,
    pcConfig = {
      'iceServers': [{
        'urls': 'stun:stun.l.google.com:19302'
      }]
    },
    video_accessed = true,
    audio_accessed = true,
    room,
    // Set up audio and video regardless of what devices are present.
    sdpConstraints = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    },
    localVideo = document.querySelector('#localVideo'),
    remoteVideo = document.querySelector('#remoteVideo'),
    videoBox = document.getElementById('videos'),
    hangupBtn = document.getElementById('hangupBtn'),
    disableVideo = document.querySelector('#disableVideo'),
    disableAudio = document.querySelector('#disableAudio'),
    createRoom = document.querySelector('#createRoom'),
    sendButton = document.querySelector('button#sendButton'),
    dataChannelSend = document.querySelector('textarea#dataChannelSend'),
    messageBox = document.getElementById('messageBox'),
    socket = io.connect();
    sendButton.onclick = sendData;
    dataChannelSend.value = "";
    function sendData() {
      var data = dataChannelSend.value;
      //本地的消息显示
      var myDiv = document.createElement("div");
      myDiv.innerHTML = data;
      myDiv.style.textAlign = "right";
      messageBox.appendChild(myDiv)
      for(var id in channelObj){
        channelObj[id].send(data);
      };
    };
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
    createChannel(id,false);
    sendMessage('back id',id);
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
    createChannel(id,true);
    doCall(id);
  }else if(message==='exit'){
    var removeNode = document.getElementById(id);
    console.log(id);
    console.log(removeNode)
    if (obj[id]&&removeNode) {
      delete obj[id]
      videoBox.removeChild(removeNode);
      console.log(videoBox)
    };
    delete channelObj[id]

  }
});
// 收到消息后的回调函数
function onReceiveMessageCallback(event) {
  // console.log(event)
  var newDiv = document.createElement("div");
  newDiv.innerHTML = event.data;
  messageBox.appendChild(newDiv)


}
////////////////////////////////////////////////////
// 通过改变audioTrack[0].enabled的值来开关麦克风
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
// 通过改变videoTrack[0].enabled的值来开关摄像头
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
  channelObj = {};
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

//创建数据通道，根据布尔值flag来判断哪一方创建方
function createChannel(id,flag){
  var dataConstraint = null;
  if (flag) {
    channelObj[id] = obj[id].createDataChannel('sendDataChannel',dataConstraint);
    console.log(channelObj[id])
    channelObj[id].onopen = function(){
      var readyState = channelObj[id].readyState;
      console.log(readyState)
      if (readyState === 'open') {
        channelObj[id].onmessage = onReceiveMessageCallback;
      }
    };
    sendMessage('channel connecting')
  }else{
    // channelObj[id].onclose = onSendChannelStateChange;
    obj[id].ondatachannel = function(event) {
      channelObj[id] = event.channel;
      channelObj[id].onmessage = onReceiveMessageCallback;
      var onReceiveChannelStateChange = function(){
        var readyState = channelObj[id].readyState;
      }
    };
  }
};


// function onSendChannelStateChange() {
//   var readyState = sendChannel.readyState;
//   trace('Send channel state is: ' + readyState);
//   if (readyState === 'open') {
//     dataChannelSend.disabled = false;
//     dataChannelSend.focus();
//     sendButton.disabled = false;
//     closeButton.disabled = false;
//   } else {
//     dataChannelSend.disabled = true;
//     sendButton.disabled = true;
//     closeButton.disabled = true;
//   }
// }



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
