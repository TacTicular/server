const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

const { createServer } = require("http");
const { Server } = require("socket.io");

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
  },
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});


let onlineUsers = []

io.on('connection', (socket) => {
  console.log("user connected", socket.id)

  onlineUsers.push({
    socketId: socket.id,
    username: socket.handshake.auth.username
  })

  io.emit('users:online', onlineUsers)

  socket.on('disconnect', () => {
    onlineUsers = onlineUsers.filter(u => {
      return u.socketId !== socket.id
    })
  })
})



server.listen(port, () => {
  console.log(`Server running at: http://localhost:${port}`);
});
