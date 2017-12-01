'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(3000);

var connections = {};
var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }
  socket.on('message', function(message,id) {
    log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
    console.log(connections)
    console.log(message)
    if (message==="back id"||message.type=="answer"||message.type=="offer") {
      socket.to(id).emit('message',message,socket.id);
    }else if(message=="hangup"){
      delete connections[socket.id];
      socket.broadcast.emit('message','exit',socket.id);
    }else{
      socket.broadcast.emit('message', message,socket.id);
    }
  });
  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);
    //进入房间后将socket.id加入到connections对象中
    connections[socket.id] = {};
    var numClients = io.sockets.sockets.length;
    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 1) {
      socket.join(room);
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('join', room,socket.id,connections);
      // socket.to(socket.id).emit('my message', socket.id,connections);
    } else{
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room)
      // socket.to(socket.id).emit('my message', socket.id,connections);
      socket.join(room);
      socket.emit('join', room,socket.id,connections);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } 
    // else { // max two clients
    //   socket.emit('full', room);
    // }
  });
  socket.on('back id', function(id) {
    socket.to(id).emit('message','back from id',socket.id)
  });
socket.on('disconnect', function(){
  console.log("receive disconnect event");
  delete connections[socket.id];
  socket.broadcast.emit('message', 'exit',socket.id);
})
  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  // socket.on('bye', function(){
  //   console.log('received bye');
  // });

});
