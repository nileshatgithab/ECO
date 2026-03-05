const socket = io("http://localhost:3000");

console.log("Connecting to signaling server...");

socket.on("connect", () => {
  console.log("✅ Connected to server! My ID:", socket.id);
});

socket.on("ready", () => {
  console.log("🔔 Both peers connected! Starting WebRTC...");
});

socket.on("peer-left", () => {
  console.log("❌ Other peer disconnected!");
});
