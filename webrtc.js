const socket = io();

// ── Connection state ──
let pc = null; // RTCPeerConnection object
let myRoom = null; // Current room code shared between 2 peers
let dataChannel = null; // DataChannel pipe for file transfer

// ── Receive state (Hybrid Direct-to-Disk + RAM Fallback) ──
let isReceiving = false; // Flag to track if file is being received
let incomingMeta = null; // Metadata of incoming file (name, size, type)
let fileStream = null; // File stream for direct-to-disk saving
let writeQueue = Promise.resolve(); // Queue to handle sequential disk writes
let receiveBuffer = []; // RAM buffer for fallback browsers
let receivedSize = 0; // Tracks how many bytes received so far
let transferCount = 0; // Counts total transfers in session

// ── Send state ──
let activeSendFile = null; // File currently being sent

const CHUNK_SIZE = 16384; // 16KB per chunk - optimal size for DataChannel

console.log("Connecting to signaling server...");

// Fires when socket connects to server.js
// Updates UI badge to show searching state
socket.on("connect", () => {
  console.log("✅ Connected! My ID:", socket.id);
  $("connDot").className = "conn-dot searching";
  $("connText").textContent = "Waiting for peer…";
});

// Starter/Trigger - fires when both peers are in the same room
// This peer becomes the initiator and creates the WebRTC offer
socket.on("ready", async () => {
  console.log("🔔 I am the initiator — creating offer...");
  pc = createPC();
  dataChannel = pc.createDataChannel("eco-transfer"); // create pipe BEFORE offer
  setupDataChannel(dataChannel);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer); // save offer on this side
  socket.emit("offer", { code: myRoom, data: offer }); // send to server to relay
});

// Peer B receives offer from Peer A via server relay
// Creates answer and sends it back through server
socket.on("offer", async (offer) => {
  if (pc) return; // ignore if already connected
  pc = createPC();
  myRoom = $("my-code").textContent;
  pc.ondatachannel = (e) => {
    // Peer B receives the DataChannel Peer A created
    dataChannel = e.channel;
    setupDataChannel(dataChannel);
  };
  await pc.setRemoteDescription(new RTCSessionDescription(offer)); // save Peer A's offer
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer); // save our answer
  socket.emit("answer", { code: myRoom, data: answer }); // send answer back via server
});

// Peer A receives Peer B's answer via server relay
// Completes the SDP exchange
socket.on("answer", async (answer) => {
  if (pc && pc.signalingState === "have-local-offer") {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

// Both peers receive ICE candidates from each other via server relay
// Adds each candidate to find the best direct path between peers
socket.on("ice-candidate", async (candidate) => {
  if (pc) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn("ICE error:", e);
    }
  }
});

// Bouncer - fires when room already has 2 peers
// Blocks 3rd person from joining
socket.on("room-full", () => {
  onRoomFull();
});

// Fires when Peer B joins the room
// Updates bridge animation to show friend found
socket.on("peer-joined", () => {
  $("bridge-caption").textContent = "Friend found! Connecting…";
});

// Cleanup - fires when other peer disconnects or closes tab
// Resets UI back to disconnected state
socket.on("peer-left", () => {
  S.connected = false;
  $("connDot").className = "conn-dot";
  $("connText").textContent = "Not connected";
  $("peer-input").disabled = false;
  toast("⚠️", "Peer left", "The other person disconnected.");
});

// Creates and configures a new RTCPeerConnection
// Uses 2 STUN servers for better connectivity across networks
function createPC() {
  const peer = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }, // Primary STUN server
      { urls: "stun:stun1.l.google.com:19302" }, // Backup STUN server
    ],
  });

  // ICE Candidate Handler - sends each candidate to other peer via server
  peer.onicecandidate = ({ candidate }) => {
    if (candidate)
      socket.emit("ice-candidate", { code: myRoom, data: candidate });
  };

  // Connection State Monitor - updates UI based on connection status
  peer.onconnectionstatechange = () => {
    console.log("Connection state:", peer.connectionState);

    // P2P connection fully established - update UI to connected state
    if (peer.connectionState === "connected") {
      S.connected = true;
      $("connDot").className = "conn-dot live";
      $("connText").textContent = "Connected";
      activateBridge();
      onPeerConnected();
      $("peer-input").value = "";
      $("peer-input").disabled = true;
      toast("🔗", "Connected!", "Direct encrypted link established.");
      if (S.file) updateSendSection();
    }

    // Connection lost - reset UI back to disconnected state
    if (
      peer.connectionState === "disconnected" ||
      peer.connectionState === "failed"
    ) {
      S.connected = false;
      $("connDot").className = "conn-dot";
      $("connText").textContent = "Not connected";
      $("peer-input").disabled = false;
      toast("⚠️", "Disconnected", "Peer left.");
    }
  };

  return peer;
}

//  DATA CHANNEL

// Sets up the DataChannel for binary file transfer
// binaryType must be arraybuffer for file chunks
function setupDataChannel(channel) {
  channel.binaryType = "arraybuffer";
  channel.onmessage = handleMessage; // all messages go through handleMessage
}

// Main message handler for DataChannel
// Handles both JSON control messages and binary file chunks
async function handleMessage(e) {
  if (typeof e.data === "string") {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }

    // ── START SIGNAL - Receiver gets file metadata before chunks arrive ──
    if (msg.type === "start") {
      isReceiving = true;
      incomingMeta = msg.meta;
      receivedSize = 0;
      receiveBuffer = [];
      transferCount++;
      console.log(
        "📥 Incoming file:",
        incomingMeta.name,
        "transfer #" + transferCount,
      );
      showReceiveUI(incomingMeta);

      if ("showSaveFilePicker" in window) {
        // Modern Browser (Chrome/Edge): Ask for save location before receiving
        $("prog-sub").textContent = "Waiting for you to accept...";
        document.querySelector(".prog-track").style.display = "none";
        document.querySelector(".speedo").style.display = "none";

        const acceptBtn = document.createElement("button");
        acceptBtn.className = "btn btn-primary btn-full";
        acceptBtn.id = "accept-save-btn";
        acceptBtn.style.marginTop = "15px";
        acceptBtn.innerHTML = "💾 Choose save location";

        acceptBtn.onclick = async () => {
          try {
            // Opens native file save dialog
            const handle = await window.showSaveFilePicker({
              suggestedName: incomingMeta.name,
            });
            fileStream = await handle.createWritable();

            acceptBtn.remove();
            document.querySelector(".prog-track").style.display = "block";
            document.querySelector(".speedo").style.display = "flex";
            $("prog-sub").textContent = "Receiving…";

            // Tell sender we are ready to receive chunks
            dataChannel.send(JSON.stringify({ type: "ready" }));
          } catch (err) {
            // User cancelled save dialog - abort transfer
            console.warn("User cancelled save:", err);
            isReceiving = false;
            dataChannel.send(JSON.stringify({ type: "abort" }));
            doReset();
          }
        };
        $("send-active").insertBefore(acceptBtn, $("prog-sub").nextSibling);
      } else {
        // Legacy/Privacy Browser (Brave/Firefox): RAM Fallback
        // Collect all chunks in memory then auto-download at end
        console.log("⚠️ Privacy Browser detected. Falling back to RAM buffer.");
        $("prog-sub").textContent = "Receiving…";
        dataChannel.send(JSON.stringify({ type: "ready" }));
      }
    }

    // Sender starts streaming chunks when receiver is ready
    if (msg.type === "ready") startSendingChunks();

    // Receiver cancelled - abort the transfer on sender side
    if (msg.type === "abort") {
      toast("⚠️", "Cancelled", "Receiver cancelled the transfer.");
      doAbort();
    }
    return;
  }

  // ── BINARY CHUNKS - Actual file data arriving ──
  if (!isReceiving || !incomingMeta) return;

  if (fileStream) {
    // MODE 1: Direct-to-Disk (Chrome/Edge)
    // Write each chunk directly to disk as it arrives
    writeQueue = writeQueue.then(async () => {
      await fileStream.write(e.data);
      receivedSize += e.data.byteLength;

      const pct = Math.floor((receivedSize / incomingMeta.size) * 100);
      updateReceiveProgress(pct, receivedSize, incomingMeta.size);

      // All chunks received - close file stream
      if (receivedSize >= incomingMeta.size) {
        isReceiving = false;
        await fileStream.close();
        fileStream = null;
        console.log("🎉 File saved to disk successfully.");
        onTransferComplete("receiver");
      }
    });
  } else {
    // MODE 2: RAM Fallback (Brave/Firefox)
    // Collect all chunks in memory then create download link at end
    receiveBuffer.push(e.data);
    receivedSize += e.data.byteLength;

    const pct = Math.floor((receivedSize / incomingMeta.size) * 100);
    updateReceiveProgress(pct, receivedSize, incomingMeta.size);

    // All chunks received - combine and trigger download
    if (receivedSize >= incomingMeta.size) {
      isReceiving = false;

      const blob = new Blob(receiveBuffer, { type: incomingMeta.type });
      const savedMeta = incomingMeta;
      receiveBuffer = [];
      receivedSize = 0;
      incomingMeta = null;

      // Create temporary download link and click it automatically
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = savedMeta.name;
      a.click();
      URL.revokeObjectURL(url); // free memory after download

      console.log("🎉 File downloaded via fallback.");
      incomingMeta = savedMeta;
      onTransferComplete("receiver");
    }
  }
}

//  SEND FILE

// Initiates file transfer by sending metadata first
// Actual chunks only start after receiver confirms ready
function sendFileOverChannel(file) {
  if (!pc || pc.connectionState !== "connected") return false;
  if (!dataChannel || dataChannel.readyState !== "open") return false;

  activeSendFile = file;
  console.log("📤 Sending START signal for:", file.name);

  // Send metadata first so receiver knows filename, size and type
  const startMsg = {
    type: "start",
    meta: { name: file.name, size: file.size, type: file.type },
  };
  dataChannel.send(JSON.stringify(startMsg));

  $("prog-sub").textContent = "Waiting for friend to choose save location…";
  return true;
}

// Streams file in 16KB chunks through DataChannel
// Uses bufferedAmount check to avoid overwhelming the channel
function startSendingChunks() {
  if (!activeSendFile) return;
  console.log("📤 Receiver ready. Streaming chunks...");

  $("prog-sub").textContent = "Encrypting and sending…";

  const reader = new FileReader();
  let offset = 0;
  const file = activeSendFile;

  const sendNextChunk = () => {
    // All chunks sent - transfer complete
    if (offset >= file.size) {
      activeSendFile = null;
      return;
    }

    // Buffer check - slow down if DataChannel is overwhelmed
    // prevents dropped chunks on large files
    if (dataChannel.bufferedAmount > CHUNK_SIZE * 64) {
      setTimeout(sendNextChunk, 10); // wait 10ms and retry
      return;
    }
    reader.readAsArrayBuffer(file.slice(offset, offset + CHUNK_SIZE));
  };

  reader.onload = (e) => {
    dataChannel.send(e.target.result); // send chunk through P2P pipe
    offset += e.target.result.byteLength; // move forward by chunk size

    // Update progress bar on sender side
    updateSendProgress(
      Math.floor((offset / file.size) * 100),
      offset,
      file.size,
    );

    if (offset < file.size) {
      sendNextChunk(); // send next chunk
    } else {
      console.log("✅ File stream complete");
      setTimeout(() => onTransferComplete("sender"), 600);
    }
  };

  sendNextChunk(); // kick off the chain
}

//  UI HELPERS

// Updates sender progress bar and byte counter
function updateSendProgress(pct, transferred, total) {
  $("prog-bar").style.width = pct + "%";
  $("prog-pct").textContent = pct + "%";
  $("speedo-sub").textContent =
    fmtBytes(transferred) + " of " + fmtBytes(total);
}

// Shows receive UI when incoming file is detected
// Resets all progress indicators for fresh transfer
function showReceiveUI(meta) {
  // Force reset success screen if receiver left it open
  $("sec-success").style.display = "none";

  const emoji = fileEmoji(meta.type);
  $("send-file-desc").textContent = `${meta.name} · ${fmtBytes(meta.size)}`;
  $("send-peer-desc").textContent = `Receiving from peer…`;

  show("sec-send", "reveal");
  setStep(3);
  hide("send-idle");
  show("send-active");

  const oldBtn = $("accept-save-btn");
  if (oldBtn) oldBtn.remove();
  document.querySelector(".prog-track").style.display = "block";
  document.querySelector(".speedo").style.display = "flex";

  document.querySelector(".prog-label").textContent = "Receiving file…";
  $("prog-bar").style.width = "0%";
  $("prog-pct").textContent = "0%";
  $("prog-sub").textContent = `${emoji} ${meta.name}`;
  $("speedo-val").textContent = "0 MB/s";
  $("speedo-sub").textContent = `0 B of ${fmtBytes(meta.size)}`;
  toast(emoji, "Incoming file!", meta.name + " · " + fmtBytes(meta.size));
}

// Updates receiver progress bar and byte counter
function updateReceiveProgress(pct, received, total) {
  $("prog-bar").style.width = pct + "%";
  $("prog-pct").textContent = pct + "%";
  $("speedo-sub").textContent = fmtBytes(received) + " of " + fmtBytes(total);
  $("prog-sub").textContent = pct < 100 ? "Receiving…" : "Done!";
}

// Auto joins room after page loads
// Waits 1 second to ensure UI is fully rendered first
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const myCode = $("my-code").textContent;
    if (myCode && myCode !== "—") {
      socket.emit("join-room", myCode); // tell server to join this room
    }
  }, 1000);
});
