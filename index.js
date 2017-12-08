'use strict';

// var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var https = require('https');
var socketIO = require('socket.io');
var fs = require('fs');  
var path = require('path');

//根据项目的路径导入生成的证书文件  
var privateKey  = fs.readFileSync(path.join(__dirname, './certificate/private.pem'), 'utf8');  
var certificate = fs.readFileSync(path.join(__dirname, './certificate/file.crt'), 'utf8');  
var credentials = {key: privateKey, cert: certificate}; 

// http
// var fileServer = new(nodeStatic.Server)();
// var app = http.createServer(function(req, res) {
//   fileServer.serve(req, res);
// }).listen(3000);

// https
var fileServers = new(nodeStatic.Server)();
var app = https.createServer(credentials,function(req, res) {
  fileServers.serve(req, res);
}).listen(3001);

var io = socketIO.listen(app);
// 创建后的房间都存入这个对象中
var roomObj = {};
var userObj = {};
io.sockets.on('connection', function(socket) {
  var curRoom;
  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  };

  /** 监听消息
  /*@param message 需要传递的信息
  /*@param id 信息接受方id
  */
  socket.on('message', function(message,id) {
    //当前房间如果存在触发方的id，则允许操作
    if (roomObj[curRoom].indexOf(socket.id)!==-1) {
      log('Client said: ', message);
      // for a real app, would be room-only (not broadcast)
      if (message==="id back"||message.type=="answer"||message.type=="offer") {
        socket.to(id).emit('message',message,socket.id,userObj);
      }else{
        socket.to(curRoom).broadcast.emit('message', message,socket.id,userObj);
      }
    }
  });

  socket.on('create or join', function(room,username) {
    if (!roomObj[room]) {
      roomObj[room] = [];
    }
    userObj[socket.id] = username;
    // console.log(userObj)
    // 将用户socket id加入房间名单中
    roomObj[room].push(socket.id);
    //将获取到的room信息赋给该连接的全局变量curRoom
    curRoom = room;
    log('Received request to create or join room ' + room);
    //
    var numClients = roomObj[room].length;
    log('Room ' + room + ' now has ' + numClients + ' client(s)');
    socket.join(room);
    log('Client ID ' + socket.id + ' created room ' + room);
    socket.emit('join', room,socket.id,numClients);
  });
  
  socket.on('leave', function () {
    socket.emit('disconnect');
  });
  socket.on('disconnect', function(){
    console.log("receive disconnect event");
    // 退出房间
    // console.log(userObj)
    socket.leave(curRoom,function(){
    delete userObj[socket.id]
      socket.to(curRoom).broadcast.emit('message', 'exit',socket.id,userObj);
    }); 
    if (roomObj[curRoom]) {
      var index = roomObj[curRoom].indexOf(socket.id);
      if (index !== -1) {
        roomObj[curRoom].splice(index, 1);
      }
      log('clients',roomObj)
    };
  });
  // socket.on('ipaddr', function() {
  //   var ifaces = os.networkInterfaces();
  //   for (var dev in ifaces) {
  //     ifaces[dev].forEach(function(details) {
  //       if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
  //         socket.to(curRoom).emit('ipaddr', details.address);
  //       }
  //     });
  //   }
  // });

  // socket.on('bye', function(){
  //   console.log('received bye');
  // });

});
