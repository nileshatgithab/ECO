/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ECO SIGNALING SERVER
   This server ONLY acts as a matchmaker. It introduces
   the two peers to each other. Once connected, the WebRTC 
   DataChannel handles the files directly between devices. 
   
   🔒 ZERO files ever touch this server!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });

// Serve the frontend HTML, CSS, and JS files from this directory
app.use(express.static(__dirname));

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // ── 1. ROOM MANAGEMENT (MAX 2 PEERS) ──
  socket.on("join-room", (code) => {
    // Check how many people are currently in this specific room code
    const room = io.sockets.adapter.rooms.get(code);
    const size = room ? room.size : 0;

    // Enforce a strict 1-to-1 connection limit for privacy and security
    if (size >= 2) {
      socket.emit("room-full");
      console.log(`⛔ ${socket.id} tried to join full room: ${code}`);
      return;
    }

    // Add user to the room
    socket.join(code);
    socket.currentRoom = code;
    console.log(`🏠 ${socket.id} joined room: ${code} (size now: ${size + 1})`);

    // If this is the second person joining, the room is ready to bridge!
    if (size === 1) {
      // Tell the second person to act as the "Initiator" and create the WebRTC Offer
      socket.emit("ready");
      // Tell the first person that their friend has arrived
      socket.to(code).emit("peer-joined");
    }
  });

  // ── 2. WEBRTC HANDSHAKE RELAY ──
  // These act as invisible mailmen. Peer A gives the server an envelope,
  // and the server hands it directly to Peer B inside the same room.

  // Relay the SDP Offer (The "Call")
  socket.on("offer", ({ code, data }) => socket.to(code).emit("offer", data));

  // Relay the SDP Answer (The "Pickup")
  socket.on("answer", ({ code, data }) => socket.to(code).emit("answer", data));

  // Relay ICE Candidates (The "Network Routing Paths" to punch through firewalls)
  socket.on("ice-candidate", ({ code, data }) =>
    socket.to(code).emit("ice-candidate", data),
  );

  // ── 3. DISCONNECTION CLEANUP ──
  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
    // If they were in a room, tell the other person the connection broke
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit("peer-left");
    }
  });
});

// ── START SERVER ──
const PORT = process.env.PORT || 3000;
http.listen(PORT, () =>
  console.log(`🚀 Signaling server running on port ${PORT}`),
);
