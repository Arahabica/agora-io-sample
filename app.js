const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const rtcToken = require('./rtcToken')
const PORT = 8080;

if (!process.env.APP_ID || !process.env.APP_CERTIFICATE) {
  throw new Error("required APP_ID and APP_CERTIFICATE environment variables.")
}

app.disable('x-powered-by');
app.set('port', PORT);

app.use(express.static('public'));

app.get('/rtcToken', rtcToken);
app.get('/appId',  (req, resp) =>  resp.json({ 'appId': process.env.APP_ID }));

const publicKeys = {};
const rooms = {};
io.on('connection',function(socket){
  socket.on('join', function(room, publicKey){
    console.log('join!')
    if (rooms[room] && rooms[room].length > 1) {
      io.to(socket.id).emit('leave', { room });
      return
    }
    socket.join(room);
    publicKeys[socket.id] = publicKey;
    if (!rooms[room]) {
      rooms[room] = []
    }
    rooms[room].push(socket.id)
    socket.to(room).emit('publicKey', { room, publicKey: publicKeys[socket.id] });
    rooms[room].forEach(uid => {
      if (uid !== socket.id) {
        io.to(socket.id).emit('publicKey', {room, publicKey: publicKeys[uid]});
      }
    });
    socket.on('leave', function(room){
      console.log('leave!')
      socket.leave(room);
      delete publicKeys[socket.id];
      if (rooms[room]) {
        rooms[room] = rooms[room].filter(id => id !== socket.id);
      }
    });
  });
});
http.listen(app.get('port'), function() {
  console.log('open http://localhost:' + app.get('port'));
});
