const socket = io();

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   STATE MANAGEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
// ── Connection state ──
let pc = null; // RTCPeerConnection object
let myRoom = null; // Current room code shared between 2 peers
let dataChannel = null; // DataChannel pipe for file transfer

// ── Receive state (Hybrid Direct-to-Disk + RAM Fallback) ──
let isReceiving = false; // Flag to track if file is being received
let incomingMeta = null; // Metadata of incoming file (name, size, type)
let fileStream = null; // File stream for direct-to-disk saving (Chrome/Edge)
let writeQueue = Promise.resolve(); // Queue to handle sequential disk writes
let receiveBuffer = []; // RAM buffer for fallback browsers (Firefox/Brave)
let receivedSize = 0; // Tracks how many bytes received so far
let transferCount = 0; // Counts total transfers in session

// ── Send state ──
let activeSendFile = null; // File currently being sent
const CHUNK_SIZE = 16384; // 16KB per chunk - optimal size for WebRTC DataChannel

console.log("Connecting to signaling server...");

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SIGNALING SERVER (SOCKET.IO)
   Handles finding peers and exchanging connection info
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

// Fires when socket connects to server.js
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
socket.on("offer", async (offer) => {
  if (pc) return; // ignore if already connected
  pc = createPC();
  myRoom = $("my-code").textContent;
  pc.ondatachannel = (e) => {
    // Peer B receives the DataChannel Peer A created
    dataChannel = e.channel;
    setupDataChannel(dataChannel);
  };
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { code: myRoom, data: answer });
});

// Peer A receives Peer B's answer via server relay
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
socket.on("room-full", () => {
  onRoomFull();
});

// Fires when Peer B joins the room
socket.on("peer-joined", () => {
  $("bridge-caption").textContent = "Friend found! Connecting…";
});

// Cleanup - fires when other peer disconnects or closes tab
socket.on("peer-left", () => {
  S.connected = false;
  $("connDot").className = "conn-dot";
  $("connText").textContent = "Not connected";
  $("peer-input").disabled = false;
  toast("⚠️", "Peer left", "The other person disconnected.");
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   WEBRTC PEER CONNECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

// Creates and configures a new RTCPeerConnection
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

    // P2P connection fully established
    if (peer.connectionState === "connected") {
      S.connected = true;
      $("connDot").className = "conn-dot live";
      $("connText").textContent = "Connected";
      activateBridge();
      onPeerConnected();
      $("peer-input").value = "";
      $("peer-input").disabled = true;
      toast("🔗", "Connected!", "Direct encrypted link established.");
      if (S.files.length > 0) updateSendSection();
    }

    // Connection lost
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DATA CHANNEL SETUP & ROUTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

// Sets up the DataChannel for binary file transfer
function setupDataChannel(channel) {
  channel.binaryType = "arraybuffer";
  channel.onmessage = handleMessage; // All incoming traffic goes to the router
}

// Main message handler for DataChannel (The Router)
async function handleMessage(e) {
  // ── 1. ROUTER: JSON CONTROL SIGNALS & COMPRESSED CHUNKS ──
  // If the message is a string, it's either metadata or a compressed payload
  if (typeof e.data === "string") {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }

    // START SIGNAL - Receiver gets file metadata before chunks arrive
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
            console.warn("User cancelled save:", err);
            isReceiving = false;
            dataChannel.send(JSON.stringify({ type: "abort" }));
            doReset();
          }
        };
        $("send-active").insertBefore(acceptBtn, $("prog-sub").nextSibling);
      } else {
        // Legacy/Privacy Browser Fallback
        console.log("⚠️ Privacy Browser detected. Falling back to RAM buffer.");
        $("prog-sub").textContent = "Receiving…";
        dataChannel.send(JSON.stringify({ type: "ready" }));
      }
    }

    // Sender starts streaming chunks when receiver confirms ready
    if (msg.type === "ready") startSendingChunks();

    // Receiver cancelled - abort the transfer
    if (msg.type === "abort") {
      toast("⚠️", "Cancelled", "Receiver cancelled the transfer.");
      doAbort();
    }

    // DECOMPRESS INCOMING BYTES (HUFFMAN + RLE)
    if (msg.type === "huffman-chunk") {
      // 1. Unpack the bits back into bytes (Huffman)
      const huffmanBytes = HuffmanCoder.decode(
        msg.payload,
        msg.bitLength,
        msg.tree,
      );
      // 2. Expand the [Count, Value] runs back into original data (RLE)
      const decodedBytes = RLEncoder.decode(huffmanBytes);
      // Pass the decompressed bytes into the unified save logic
      saveReceivedData(decodedBytes);
      return;
    }

    return;
  }

  // ── 2. ROUTER: RAW BINARY CHUNKS (Bypassed) ──
  // If the Smart Filter skipped compression, it arrives here as an ArrayBuffer
  if (!isReceiving || !incomingMeta) return;
  saveReceivedData(new Uint8Array(e.data));
}

// ── UNIFIED SAVE LOGIC ──
// Extracted so both compressed and raw routers save files the exact same way
function saveReceivedData(bytes) {
  // Edge Case: 0-byte file completion
  if (incomingMeta.size === 0) {
    isReceiving = false;
    onTransferComplete("receiver");
    return;
  }

  if (fileStream) {
    // MODE 1: Direct-to-Disk (Chrome/Edge)
    writeQueue = writeQueue.then(async () => {
      await fileStream.write(bytes);
      receivedSize += bytes.byteLength;
      updateReceiveProgress(
        Math.floor((receivedSize / incomingMeta.size) * 100),
        receivedSize,
        incomingMeta.size,
      );
      if (receivedSize >= incomingMeta.size) {
        isReceiving = false;
        await fileStream.close();
        fileStream = null;
        onTransferComplete("receiver"); // Triggers next file in batch
      }
    });
  } else {
    // MODE 2: RAM Fallback (Firefox/Brave)
    receiveBuffer.push(bytes);
    receivedSize += bytes.byteLength;
    updateReceiveProgress(
      Math.floor((receivedSize / incomingMeta.size) * 100),
      receivedSize,
      incomingMeta.size,
    );
    if (receivedSize >= incomingMeta.size) {
      isReceiving = false;
      const blob = new Blob(receiveBuffer, { type: incomingMeta.type });
      const savedMeta = incomingMeta;
      receiveBuffer = [];
      receivedSize = 0;
      incomingMeta = null;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = savedMeta.name;
      a.click();
      URL.revokeObjectURL(url);
      incomingMeta = savedMeta;
      onTransferComplete("receiver"); // Triggers next file in batch
    }
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FILE SENDING LOGIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

// Initiates file transfer by sending metadata first
function sendFileOverChannel(file) {
  if (!pc || pc.connectionState !== "connected") return false;
  if (!dataChannel || dataChannel.readyState !== "open") return false;

  activeSendFile = file;
  console.log("📤 Sending START signal for:", file.name);

  const startMsg = {
    type: "start",
    meta: { name: file.name, size: file.size, type: file.type },
  };
  dataChannel.send(JSON.stringify(startMsg));

  $("prog-sub").textContent = "Waiting for friend to choose save location…";
  return true;
}

// ── COMPRESS REAL BYTES, SMART FILTER & TRACK LIVE SPEED ──
// Streams file in 16KB chunks through DataChannel
function startSendingChunks() {
  if (!activeSendFile) return;
  console.log("📤 Receiver ready. Streaming chunks...");

  const file = activeSendFile;
  const reader = new FileReader();
  let offset = 0;
  let totalCompressedBytesSent = 0;

  // Variables for Live Speedometer
  let startTime = performance.now();
  let lastReportTime = startTime;
  let bytesSinceLastReport = 0;
  let peakSpeed = 0;

  // ✨ SMART FILTER ✨
  // Check if file is uncompressible (video, image, zip, pdf, audio)
  // Bypassing these saves massive amounts of CPU power
  const skipCompression =
    file.type.startsWith("video/") ||
    file.type.startsWith("image/") ||
    file.type.startsWith("audio/") ||
    file.type.includes("zip") ||
    file.type.includes("pdf");

  if (skipCompression) {
    $("prog-sub").textContent = "Bypassing compression (raw transfer)…";
    console.log(`⚡ Smart Filter: Bypassing compression for ${file.type}`);
  } else {
    $("prog-sub").textContent = "Compressing and sending…";
    console.log(
      `🗜️ Smart Filter: Compressing ${file.type || "unknown format"}...`,
    );
  }

  // ✨ EMPTY FILE FIX ✨
  // If the file is 0 bytes, handle it instantly without dividing by zero
  if (file.size === 0) {
    console.log("⚠️ File is empty (0 bytes). Sending empty payload.");
    // We send an empty ArrayBuffer so receiver gets something to trigger completion
    dataChannel.send(new ArrayBuffer(0));
    $("prog-bar").style.width = "100%";
    $("prog-pct").textContent = "100%";
    $("speedo-val").textContent = "Instant ⚡";
    $("s-comp").textContent = "0 B";
    $("s-saved").textContent = "0 B";
    $("s-time").textContent = "< 1 sec";

    // Pass '0' and '0' so the UI math doesn't break
    setTimeout(() => onTransferComplete("sender", 0, 0), 300);
    return;
  }

  const sendNextChunk = () => {
    // All chunks sent - transfer complete
    if (offset >= file.size) {
      activeSendFile = null;
      return;
    }
    // Buffer check - slow down if DataChannel is overwhelmed
    if (dataChannel.bufferedAmount > CHUNK_SIZE * 64) {
      setTimeout(sendNextChunk, 10); // wait 10ms and retry
      return;
    }
    // Read EVERYTHING as raw binary arrays for real processing
    reader.readAsArrayBuffer(file.slice(offset, offset + CHUNK_SIZE));
  };

  reader.onload = (e) => {
    const rawBytes = new Uint8Array(e.target.result);

    // ✨ COMPRESSION ROUTER ✨
    if (!skipCompression) {
      // 1. Pre-process (RLE) & Compress (Huffman)
      const rleBytes = RLEncoder.encode(rawBytes);
      const compressed = HuffmanCoder.encode(rleBytes);

      // Send the packed payload, bit length, and decoding tree
      dataChannel.send(
        JSON.stringify({
          type: "huffman-chunk",
          payload: compressed.buffer,
          bitLength: compressed.bitLength,
          tree: compressed.tree,
        }),
      );

      totalCompressedBytesSent += compressed.buffer.length;
    } else {
      // 2. Send Raw ArrayBuffer (Bypass)
      dataChannel.send(e.target.result);
      totalCompressedBytesSent += rawBytes.byteLength;
    }

    // Track original bytes processed for progress bar and speed math
    offset += rawBytes.byteLength;
    bytesSinceLastReport += rawBytes.byteLength;

    // ── LIVE SPEED & UI MATH ──
    let now = performance.now();
    let timeDiff = now - lastReportTime;
    const isLastChunk = offset >= file.size;

    // Update UI if 250ms has passed OR if it's the very last chunk
    if (timeDiff > 250 || isLastChunk) {
      let safeTimeDiff = timeDiff > 0 ? timeDiff : 1; // Prevent division by zero
      let speedBps = bytesSinceLastReport / (safeTimeDiff / 1000);
      let speedMbps = (speedBps / (1024 * 1024)).toFixed(1);

      // Display "Fast" if the whole file finished in less than 50ms
      if (isLastChunk && timeDiff < 50 && speedMbps > 100) {
        $("speedo-val").textContent = "Fast ⚡";
      } else {
        $("speedo-val").textContent = speedMbps + " MB/s";
      }

      // Track Peak Speed (filtering out impossible spikes)
      if (speedMbps > peakSpeed && speedMbps < 10000) {
        peakSpeed = speedMbps;
        $("peak-spd").textContent = peakSpeed;
      }

      // Live "File Snapshot" Updates
      $("s-comp").textContent = fmtBytes(totalCompressedBytesSent);
      let saved = offset - totalCompressedBytesSent;
      $("s-saved").textContent = saved > 0 ? fmtBytes(saved) : "0 B";

      // Estimated Time Remaining
      let remainingBytes = file.size - offset;
      let secsRemaining = speedBps > 0 ? remainingBytes / speedBps : 0;
      $("s-time").textContent =
        secsRemaining < 3 ? "< 3 sec" : "~" + Math.ceil(secsRemaining) + "s";

      lastReportTime = now;
      bytesSinceLastReport = 0;
    }

    updateSendProgress(
      Math.floor((offset / file.size) * 100),
      offset,
      file.size,
    );

    if (!isLastChunk) {
      sendNextChunk();
    } else {
      console.log(
        `✅ File stream complete. Sent ${totalCompressedBytesSent} real network bytes.`,
      );
      // ✨ PASS THE MATH TO SCRIPT.JS TO SHOW ON THE UI ✨
      // Calling this triggers the batch queue to load the next file!
      setTimeout(
        () => onTransferComplete("sender", file.size, totalCompressedBytesSent),
        600,
      );
    }
  };

  sendNextChunk(); // kick off the chain
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   UI HELPERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function updateSendProgress(pct, transferred, total) {
  $("prog-bar").style.width = pct + "%";
  $("prog-pct").textContent = pct + "%";
  $("speedo-sub").textContent =
    fmtBytes(transferred) + " of " + fmtBytes(total);
}

function showReceiveUI(meta) {
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

function updateReceiveProgress(pct, received, total) {
  $("prog-bar").style.width = pct + "%";
  $("prog-pct").textContent = pct + "%";
  $("speedo-sub").textContent = fmtBytes(received) + " of " + fmtBytes(total);
  $("prog-sub").textContent = pct < 100 ? "Receiving…" : "Done!";
}

// Auto joins room after page loads to ensure UI is ready
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const myCode = $("my-code").textContent;
    if (myCode && myCode !== "—") {
      socket.emit("join-room", myCode);
    }
  }, 1000);
});
