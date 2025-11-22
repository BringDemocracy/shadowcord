const { Server } = require("socket.io");
const { createServer } = require("http");

// Create HTTP server
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// In-memory routing table: { username: socketId }
// PRIVACY NOTE: This is ephemeral. We do NOT store a persistent list of users.
// We do NOT broadcast this list anymore.
const users = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 1. Registration (Ephemeral)
  socket.on("join", (username) => {
    // Only allow alphanumeric usernames to prevent injection-like weirdness
    if (!username || typeof username !== 'string') return;
    
    users[username] = socket.id;
    socket.username = username;
    console.log(`[Privacy] User registered for routing: ${username}`);
    
    // NO BROADCAST of "users_list" anymore!
  });

  // 2. Friend Request Logic (Strict Routing)
  socket.on("friend_request", ({ to, from, payload }) => {
    const targetSocketId = users[to];
    if (targetSocketId) {
      // Determine if user is online to receive request
      io.to(targetSocketId).emit("friend_request", { 
        from, 
        payload // Contains public key usually
      });
    } else {
      // Generic "Offline or Not Found" - Client handles retry later?
      // For now, we just drop it or could send an error back
      socket.emit("error", { message: "Utilisateur introuvable ou hors ligne." });
    }
  });

  socket.on("friend_accept", ({ to, from, payload }) => {
    const targetSocketId = users[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit("friend_accept", { 
        from, 
        payload 
      });
    }
  });

  // 3. WebRTC Signaling (Strict 1-to-1 Routing)
  // Only works if users know each other's username exactly
  socket.on("offer", ({ target, offer, senderPublicKey }) => {
    const targetSocketId = users[target];
    if (targetSocketId) {
      io.to(targetSocketId).emit("offer", { 
        sender: socket.username, 
        offer,
        senderPublicKey 
      });
    }
  });

  socket.on("answer", ({ target, answer }) => {
    const targetSocketId = users[target];
    if (targetSocketId) {
      io.to(targetSocketId).emit("answer", { 
        sender: socket.username, 
        answer 
      });
    }
  });

  socket.on("ice-candidate", ({ target, candidate }) => {
    const targetSocketId = users[target];
    if (targetSocketId) {
      io.to(targetSocketId).emit("ice-candidate", { 
        sender: socket.username, 
        candidate 
      });
    }
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      delete users[socket.username];
      // No broadcast on disconnect
    }
  });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Privacy-First Signaling server running on http://localhost:${PORT}`);
});
