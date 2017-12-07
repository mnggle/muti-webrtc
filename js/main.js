'use strict';

var localStream,//本地媒体对象
    peerObj = {},// 用于存储多个RTCPeerConnection对象
    channelObj = {},//用于存储多个dataChannel对象
    fileBuffer = [],//文件流接受数组
    videoAccessed = true,//视频开关打开
    audioAccessed = true,//音频开关打开
    room,//房间名
    username,//本地用户名
    insideRoom = document.getElementById('insideRoom'),
    outsideRoom = document.getElementById('outsideRoom'),
    localName = document.getElementById('localName'),
    joinRoom = document.getElementById('joinRoom'),
    localVideo = document.querySelector('#localVideo'),
    remoteVideo = document.querySelector('#remoteVideo'),
    videoBox = document.getElementById('videos'),
    hangupBtn = document.getElementById('hangupBtn'),
    disableVideo = document.querySelector('#disableVideo'),
    disableAudio = document.querySelector('#disableAudio'),
    createJoinRoom = document.querySelector('#createJoinRoom'),
    sendButton = document.querySelector('button#sendButton'),
    sendFile = document.getElementById('sendFile'),
    textSend = document.querySelector('#textSend'),
    messageBox = document.getElementById('messageBox'),
    downloadLink = document.querySelector('a#receivedFileLink'),
    socket = io.connect();

sendButton.onclick = sendData;
createJoinRoom.onclick=createJoinFun;
hangupBtn.onclick = hangupFun;
// 输入框内容
textSend.value = "";
// 点击发送按钮触发函数
function sendData() {
  var data = textSend.value;
  //本地的消息显示
  var myDiv = document.createElement("div");
  myDiv.innerHTML = data;
  myDiv.style.textAlign = "right";
  messageBox.appendChild(myDiv)
  for(var id in channelObj){
    channelObj[id].send(data);
  };
  // 置空输入框
  textSend.value = "";
};

//创建/加入房间函数
function createJoinFun(){
  // room = prompt('Enter room name:');
  room = joinRoom.value;
  username = localName.value;
  if (room&&username) {
    socket.emit('create or join', room);
    console.log('Attempted to create or  join room', room);
    var roomName = document.getElementById('roomName');
    roomName.innerText = room;
    outsideRoom.style.display = 'none';
    insideRoom.style.display = 'block';
  }else{
    alert('请输入姓名和房间名');
    return;
  }
};
//监听join事件，当有新的peer加入时会触发
socket.on('join', function (room,id,numClients){
  if (numClients===1) {
  console.log('Created room' + room);
  }else{
    console.log('Another peer made a request to join room ' + room);
    console.log('This peer is the initiator of room ' + room + '!');
  };
  // 获取媒体对象
  getUserMidea();
  // 开始创建连接
  sendMessage('start');
});
/////////////////////////////////////////////

socket.on('log', function(array) {
  console.log.apply(console, array);
});
//向信令服务器发送消息的主要函数
//message为消息内容。如果存在id，表示回复消息给该id对应socket
function sendMessage(message,id) {
  console.log('Client sending message: ', message);
  if (id) {
    socket.emit('message', message,id);
  }else{
    socket.emit('message', message);
  }
}
// 监听消息接受
// 参数id为信令服务器中触发message事件的socket对应的id
socket.on('message', function(message,id) {
  console.log('Client received message:', message);
  // console.log(message)
  if (message === 'start') {
    startCandidtdate(id,false);
    // createChannel(id,false);
    // 接收到来自join方的id后,需提示信令服务器
    // 将己方id回复给对方
    sendMessage('id back',id);
  } else if (message.type === 'offer') {
    peerObj[id].setRemoteDescription(new RTCSessionDescription(message));
    doAnswerFun(id);
  } else if (message.type === 'answer') {
    peerObj[id].setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate') {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    peerObj[id].addIceCandidate(candidate);
  }else if(message==="id back"){
    startCandidtdate(id,true);
    createOfferFun(id);
  }else if(message==='exit'){
    var removeNode = document.getElementById(id);
    // 删除对应消息通道
    delete channelObj[id]
    if (peerObj[id]&&removeNode) {
      // 删除对应消息通道
      delete peerObj[id]
      videoBox.removeChild(removeNode);
    };
  }else if(message.type==="file message"){
    channelObj[id].fileObj = message;
  }
});

// 转换blob消息函数
function readBlobAsDataURL(blob, callback) {
    var a = new FileReader();
    a.onload = function(e) {callback(e.target.result);};
    a.readAsDataURL(blob);
};

// 通过改变audioTrack[0].enabled的值来开关麦克风
disableAudio.addEventListener('click',function(){
  console.log(localStream.getAudioTracks());
  var audioTrack = localStream.getAudioTracks();
  if (audioAccessed) {
    if (audioTrack.length > 0) {
        audioTrack[0].enabled = false;
    };
    audioAccessed  = false
  }else{
    audioTrack[0].enabled = true;
    audioAccessed  = true
  }
});
// 通过改变videoTrack[0].enabled的值来开关摄像头
disableVideo.addEventListener('click',function(){
  console.log(localStream.getVideoTracks());
  var videoTrack = localStream.getVideoTracks();
  if (videoAccessed) {
    if (videoTrack.length > 0) {
        videoTrack[0].enabled = false;
        localVideo.src = window.URL.createObjectURL(localStream);
    };
    videoAccessed  = false
  }else{
    videoTrack[0].enabled = true;
    videoAccessed  = true
  }
});


function hangupFun(){
  outsideRoom.style.display = 'block';
  insideRoom.style.display = 'none';
  socket.emit('leave');
  sendMessage('hangup');
  peerObj = {};
  channelObj = {};
  localVideo.src = "";
  var allVideoTag = videoBox.childNodes;
  // 移除除了本地意外的video 标签
  for (var i = allVideoTag.length - 1; i >= 0; i--) {
    if (allVideoTag[i].nodeName==="VIDEO"&&allVideoTag[i].id!='localVideo') {
      videoBox.removeChild(allVideoTag[i]);
    }
  };

};

//分chunk发送文件
//需要信令一个文件大小等信息
//方便接收方判断是否传送完毕
sendFile.addEventListener('change', function(ev){
  var file = sendFile.files[0];
  sendMessage({
    type:"file message",
    'filename':file.name,
    "filesize":file.size
  });
  // fileProgress.max = file.size;
  var chunkSize = 16384;
  var sliceFile = function(offset) {
    var reader = new window.FileReader();
    reader.onload = (function() {
      return function(e) {
        for(var id in channelObj){
          // channelObj[id].send(data);
          channelObj[id].send(e.target.result);
        };
        if (file.size > offset + e.target.result.byteLength) {
          window.setTimeout(sliceFile, 0, offset + chunkSize);
          }
        // fileProgress.value = offset + e.target.result.byteLength;
      };
    })(file);
    var slice = file.slice(offset, offset + chunkSize);
    reader.readAsArrayBuffer(slice);
  };
  sliceFile(0);   
}, false);


function getUserMidea(){
  navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { width: 100, height: 100 }
  })
  .then(gotStream)
  .catch(function(e) {
    //不管是否有摄像头都发送链接消息
    // sendMessage('got user media');
    alert('getUserMedia() error: ' + e.name);
  });
};
function gotStream(stream) {
  console.log('Adding local stream.');
  localVideo.src = window.URL.createObjectURL(stream);
  localStream = stream;
  // sendMessage('got user media');
};
//创建RTCPeerConnection实例，并监听stream
function startCandidtdate(id,flag) {
  // console.log('>>>>>>> startCandidtdate() ');
    createPeerConnection(id);
    if (localStream) {
      peerObj[id].addStream(localStream);
    };
    createChannel(id,flag)
};

// 创建RTCPeerConnection
// 监听addstream,icecandidate事件
function createPeerConnection(id) {
  console.log('>>>>>> creating peer connection');
  try {
    peerObj[id] = new RTCPeerConnection();
    peerObj[id].onicecandidate = handleIceCandidate;
    peerObj[id].onaddstream = function(event){
        console.log(event)
        console.log('Remote stream added.');
        var node = document.createElement('video')
        videoBox.appendChild(node);
        node.setAttribute("id", id);
        node.setAttribute("autoplay", "autoplay");
        node.src = window.URL.createObjectURL(event.stream);
        // remoteStream = event.stream;
    };
    // peerObj[id].onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
};
//onicecandidate 触发的函数
function handleIceCandidate(event) {
  // console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
};
// 执行createOffer,向其他peer发送sessionDescription
// 由加入方发起,并向信令发送对方id
function createOfferFun(id) {
  peerObj[id].createOffer().then(function(sessionDescription){
      peerObj[id].setLocalDescription(sessionDescription);
      sendMessage(sessionDescription,id);
  },handleCreateOfferError);
};
function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
};
// 执行createAnswer，向offer发出方发送数据
function doAnswerFun(id) {
  console.log('Sending answer to peer.');
  // console.log(id)
  peerObj[id].createAnswer().then(function(sessionDescription){
      sendMessage(sessionDescription,id);
      peerObj[id].setLocalDescription(sessionDescription);
  },
    onCreateSessionDescriptionError
  );
};
function onCreateSessionDescriptionError(error) {
  console.log('createAnswer() error: ', event);
}

//创建数据通道，根据布尔值flag来判断哪一方创建方
function createChannel(id,flag){
  var filesize = 0;
  // 收到消息后的回调函数
  var onReceiveMessageCallback = function(event) {
    if (typeof event.data ==="string") {
      var newDiv = document.createElement("div");
      newDiv.innerHTML = event.data;
      messageBox.appendChild(newDiv);
    }else{
      fileBuffer.push(event.data);
      filesize += event.data.byteLength;
      console.log(channelObj[id].fileObj.filesize)
      if (filesize===channelObj[id].fileObj.filesize) {
        filesize = 0;
        var received = new window.Blob(fileBuffer);
        fileBuffer = [];
        readBlobAsDataURL(received,function(dataUrl){
          var newDiv = document.createElement("div");
          var newImg = document.createElement("img");
          newImg.src=dataUrl;
          newImg.width = "100";
          newImg.height = "100";
          newDiv.appendChild(newImg);
          messageBox.appendChild(newDiv)
        })
      }
      // downloadLink.href = URL.createObjectURL(received);
      // downloadLink.download = '123';
      // downloadLink.appendChild(document.createTextNode("(" + fileSize + ") bytes"));
    }
  };
  var dataConstraint = null;
  if (flag) {
    // 创建方
    channelObj[id] = peerObj[id].createDataChannel('sendDataChannel',dataConstraint);
    console.log(channelObj[id])
    channelObj[id].onopen = function(){
      var readyState = channelObj[id].readyState;
      console.log(readyState)
      if (readyState === 'open') {
        channelObj[id].onmessage = onReceiveMessageCallback;
      }
    };
  }else{
    // 接收方
    // channelObj[id].onclose = onSendChannelStateChange;
    peerObj[id].ondatachannel = function(event) {
      channelObj[id] = event.channel;
      channelObj[id].onmessage = onReceiveMessageCallback;
      var onReceiveChannelStateChange = function(){
        var readyState = channelObj[id].readyState;
      }
    };
  }
};

// var constraints = {
//   video: true
// };
// // console.log('Getting user media with constraints', constraints);
// if (location.hostname !== 'localhost') {
//   requestTurn(
//     'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
//   );
// };




// window.onbeforeunload = function() {
//   sendMessage('bye');
// };




// function onSendChannelStateChange() {
//   var readyState = sendChannel.readyState;
//   trace('Send channel state is: ' + readyState);
//   if (readyState === 'open') {
//     textSend.disabled = false;
//     textSend.focus();
//     sendButton.disabled = false;
//     closeButton.disabled = false;
//   } else {
//     textSend.disabled = true;
//     sendButton.disabled = true;
//     closeButton.disabled = true;
//   }
// }


// function requestTurn(turnURL) {
//   var turnExists = false;
//   for (var i in pcConfig.iceServers) {
//     if (pcConfig.iceServers[i].url.substr(0, 5) === 'turn:') {
//       turnExists = true;
//       turnReady = true;
//       break;
//     }
//   }
//   if (!turnExists) {
//     console.log('Getting TURN server from ', turnURL);
//     // No TURN server. Get one from computeengineondemand.appspot.com:
//     var xhr = new XMLHttpRequest();
//     xhr.onreadystatechange = function() {
//       if (xhr.readyState === 4 && xhr.status === 200) {
//         var turnServer = JSON.parse(xhr.responseText);
//         console.log('Got TURN server: ', turnServer);
//         pcConfig.iceServers.push({
//           'url': 'turn:' + turnServer.username + '@' + turnServer.turn,
//           'credential': turnServer.password
//         });
//         turnReady = true;
//       }
//     };
//     xhr.open('GET', turnURL, true);
//     xhr.send();
//   }
// };

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
//   peerObj[fromId].close();
//   peerObj[fromId] = null;
// }

///////////////////////////////////////////

// Set Opus as the default audio codec if it's present.
// function preferOpus(sdp) {
//   var sdpLines = sdp.split('\r\n');
//   var mLineIndex;
//   // Search for m line.
//   for (var i = 0; i < sdpLines.length; i++) {
//     if (sdpLines[i].search('m=audio') !== -1) {
//       mLineIndex = i;
//       break;
//     }
//   }
//   if (mLineIndex === null) {
//     return sdp;
//   }

//   // If Opus is available, set it as the default in m line.
//   for (i = 0; i < sdpLines.length; i++) {
//     if (sdpLines[i].search('opus/48000') !== -1) {
//       var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
//       if (opusPayload) {
//         sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex],
//           opusPayload);
//       }
//       break;
//     }
//   }

//   // Remove CN in m line and sdp.
//   sdpLines = removeCN(sdpLines, mLineIndex);

//   sdp = sdpLines.join('\r\n');
//   return sdp;
// }

// function extractSdp(sdpLine, pattern) {
//   var result = sdpLine.match(pattern);
//   return result && result.length === 2 ? result[1] : null;
// }

// Set the selected codec to the first in m line.
// function setDefaultCodec(mLine, payload) {
//   var elements = mLine.split(' ');
//   var newLine = [];
//   var index = 0;
//   for (var i = 0; i < elements.length; i++) {
//     if (index === 3) { // Format of media starts from the fourth.
//       newLine[index++] = payload; // Put target payload to the first.
//     }
//     if (elements[i] !== payload) {
//       newLine[index++] = elements[i];
//     }
//   }
//   return newLine.join(' ');
// }

// // Strip CN from sdp before CN constraints is ready.
// function removeCN(sdpLines, mLineIndex) {
//   var mLineElements = sdpLines[mLineIndex].split(' ');
//   // Scan from end for the convenience of removing an item.
//   for (var i = sdpLines.length - 1; i >= 0; i--) {
//     var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
//     if (payload) {
//       var cnPos = mLineElements.indexOf(payload);
//       if (cnPos !== -1) {
//         // Remove CN payload from m line.
//         mLineElements.splice(cnPos, 1);
//       }
//       // Remove CN line in sdp
//       sdpLines.splice(i, 1);
//     }
//   }

//   sdpLines[mLineIndex] = mLineElements.join(' ');
//   return sdpLines;
// }
