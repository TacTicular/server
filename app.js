const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const port = process.env.PORT || 3000;
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
  },
});

const rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinRoom", ({ room, username }) => {
    if (!/^\d{4}$/.test(room)) {
      socket.emit("invalidRoom", "Room must be a 4-digit number");
      return;
    }

    if (!rooms[room]) {
      rooms[room] = {
        players: [],
        usernames: {},
        board: Array(9).fill(null),
        currentTurn: "X",
      };
    }

    const roomData = rooms[room];
    const existingPlayer = roomData.players.find(
      (playerId) => playerId === socket.id
    );
    if (existingPlayer) {
      const player = roomData.usernames["X"] === socket.id ? "X" : "O";
      socket.emit("assignPlayer", { player, usernames: roomData.usernames });

      io.in(room).emit("updateBoard", {
        board: roomData.board,
        currentTurn: roomData.currentTurn,
        usernames: roomData.usernames,
      });
    } else if (roomData.players.length < 2) {
      roomData.players.push(socket.id);
      const player = roomData.players.length === 1 ? "X" : "O";

      roomData.usernames[player] = username;
      socket.join(room);

      socket.emit("assignPlayer", { player, usernames: roomData.usernames });

      io.in(room).emit("updateBoard", {
        board: roomData.board,
        currentTurn: roomData.currentTurn,
        usernames: roomData.usernames,
      });

      io.in(room).emit("playerCount", roomData.players.length);

      console.log(`${username} joined room ${room} as player ${player}`);
    } else {
      socket.emit("roomFull", "Room is full");
    }
  });

  socket.on("move", ({ board, room, player }) => {
    const roomData = rooms[room];

    if (roomData && roomData.currentTurn === player) {
      roomData.board = board;
      roomData.currentTurn = player === "X" ? "O" : "X";

      io.in(room).emit("updateBoard", {
        board: roomData.board,
        currentTurn: roomData.currentTurn,
        usernames: roomData.usernames,
      });
    }
  });

  socket.on("reset", (room) => {
    if (rooms[room]) {
      rooms[room].board = Array(9).fill(null);
      rooms[room].currentTurn = "X";

      io.in(room).emit("updateBoard", {
        board: rooms[room].board,
        currentTurn: "X",
        usernames: rooms[room].usernames,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    for (const room in rooms) {
      const playerIndex = rooms[room].players.indexOf(socket.id);
      if (playerIndex !== -1) {
        rooms[room].players.splice(playerIndex, 1);
        console.log(`Player removed from room ${room}`);

        if (rooms[room].players.length === 0) {
          delete rooms[room];
        } else if (rooms[room].players.length === 1) {
          const remainingPlayerId = rooms[room].players[0];
          const remainingPlayer =
            rooms[room].usernames["X"] === remainingPlayerId ? "X" : "O";

          if (remainingPlayer === "O") {
            rooms[room].usernames["X"] = rooms[room].usernames["O"];
            delete rooms[room].usernames["O"];
            rooms[room].currentTurn = "X";
          }

          rooms[room].board = Array(9).fill(null);
          rooms[room].currentTurn = "X";

          io.to(remainingPlayerId).emit(
            "playerDisconnected",
            `Other player has disconnected. The game has been reset.`
          );

          io.in(room).emit("updateBoard", {
            board: rooms[room].board,
            currentTurn: rooms[room].currentTurn,
            usernames: rooms[room].usernames,
          });
          console.log(`Room ${room} reset as only 1 player is left.`);
        } else {
          io.in(room).emit("playerCount", rooms[room].players.length);
        }
        break;
      }
    }
  });
});

server.listen(port, () => {
  console.log(`Server running at: http://localhost:${port}`);
});
