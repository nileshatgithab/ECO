// Global execution state
const S = {
  files: [],
  currentFileIndex: 0,
  connected: false,
  peerCode: null,
  firstFile: true,
  peak: 0,
  batchOrig: 0,
  batchComp: 0,
};

// DOM HELPERS
const $ = (id) => document.getElementById(id);

const show = (id, animClass = "") => {
  const el = $(id);
  el.style.display = "";
  if (animClass) {
    el.classList.remove(animClass);
    void el.offsetWidth;
    el.classList.add(animClass);
  }
};

const hide = (id) => {
  $(id).style.display = "none";
};

// UTILITY FUNCTIONS
function fmtBytes(b) {
  if (!b || b === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return (b / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}

function fileEmoji(type) {
  if (!type) return "📁";
  if (type.includes("image")) return "🖼️";
  if (type.includes("pdf")) return "📋";
  if (type.includes("video")) return "🎬";
  if (type.includes("audio")) return "🎵";
  if (type.includes("zip") || type.includes("rar") || type.includes("tar"))
    return "📦";
  if (
    type.includes("text") ||
    type.includes("json") ||
    type.includes("javascript") ||
    type.includes("html") ||
    type.includes("css")
  )
    return "📝";
  return "📁";
}

function wordCode() {
  const words = [
    "PINE",
    "MINT",
    "SAGE",
    "OPAL",
    "DUSK",
    "TIDE",
    "FERN",
    "DOVE",
    "WREN",
    "REEF",
    "COVE",
    "MIST",
    "GLOW",
    "LARK",
    "ARCH",
  ];
  return (
    words[Math.floor(Math.random() * words.length)] +
    "-" +
    (Math.floor(Math.random() * 9000) + 1000)
  );
}

// TOAST NOTIFICATION
function toast(icon, title, sub = "") {
  $("toast-icon").textContent = icon;
  $("toast-title").textContent = title;
  $("toast-sub").textContent = sub;
  const t = $("toast");
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3500);
}

// STEPPER
function setStep(n) {
  for (let i = 1; i <= 3; i++) {
    const el = $("s" + i);
    el.classList.remove("active", "done");
    if (i < n) el.classList.add("done");
    else if (i === n) el.classList.add("active");
  }
  $("sc1").className =
    "step-connector" + (n > 1 ? " done" : n === 1 ? " active" : "");
  $("sc2").className =
    "step-connector" + (n > 2 ? " done" : n === 2 ? " active" : "");
}

// DRAG AND DROP HANDLERS
function onDragOver(e) {
  e.preventDefault();
  if (S.files.length === 0) $("dropzone").classList.add("drag-over");
}

function onDragLeave() {
  $("dropzone").classList.remove("drag-over");
}

function onDrop(e) {
  e.preventDefault();
  $("dropzone").classList.remove("drag-over");
  if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
}

function onFileSelect(e) {
  if (e.target.files.length > 0) {
    processFiles(e.target.files);
    e.target.value = "";
  }
}

// BATCH PROCESSING
function processFiles(fileList) {
  $("sec-success").style.display = "none";
  hide("send-active");
  show("send-idle");

  const sendBtn = $("send-btn");
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.textContent = "Send batch →";
    sendBtn.style.background = "";
    sendBtn.style.boxShadow = "";
  }

  const newFiles = Array.from(fileList);
  S.files = [...S.files, ...newFiles];
  S.currentFileIndex = 0;

  S.batchOrig = 0;
  S.batchComp = 0;

  const totalSize = S.files.reduce((acc, file) => acc + file.size, 0);
  const isMultiple = S.files.length > 1;

  $("dropzone").classList.add("loaded");
  hide("empty-state");
  $("file-row").style.display = "flex";

  if (isMultiple) {
    $("drop-hero").innerHTML = `<span>📚</span>`;
    $("file-thumb").innerHTML = `<span>📚</span>`;
    $("file-name").textContent = `${S.files.length} files queued`;
    $("file-meta").textContent = `Batch • ${fmtBytes(totalSize)}`;
  } else {
    const file = S.files[0];
    const emoji = fileEmoji(file.type);
    $("drop-hero").innerHTML = `<span>${emoji}</span>`;
    $("file-thumb").innerHTML = `<span>${emoji}</span>`;
    $("file-name").textContent = file.name;
    $("file-meta").textContent = `${fmtBytes(file.size)}`;
  }

  $("file-chips").innerHTML = `
    <span class="chip chip-teal">✓ Loaded</span>
    <span class="chip chip-green">Smart Engine ⚡</span>
  `;

  show("sec-compression");
  $("c-pct").innerHTML = `<span style="font-size: 32px">Live ⚡</span>`;
  $("c-detail").innerHTML =
    `<strong>${fmtBytes(totalSize)}</strong> will be processed dynamically.<br>Smart filter active.`;

  $("s-orig").textContent = fmtBytes(totalSize);
  $("s-comp").textContent = "TBD";
  $("s-time").textContent = "Live";
  $("s-saved").textContent = "TBD";

  setStep(2);

  if (S.firstFile) {
    S.firstFile = false;
    setTimeout(() => $("coach1").classList.add("on"), 600);
  }

  if (S.connected) updateSendSection();
  toast(
    "📂",
    "Files added",
    `You now have ${S.files.length} file(s) ready to stream.`,
  );
}

function clearFile() {
  S.files = [];
  S.currentFileIndex = 0;
  S.batchOrig = 0;
  S.batchComp = 0;

  $("dropzone").classList.remove("loaded");
  show("empty-state");
  hide("sec-compression");
  if (!S.connected) hide("sec-connect");
  hide("sec-send");
  if (!S.connected) show("sec-how");
  hide("file-row");
  $("file-input").value = "";
  $("drop-hero").innerHTML = '<span id="drop-emoji">📂</span>';
  $("coach1").classList.remove("on");

  setStep(1);
}

// CONNECTION DOM BINDINGS
function jumpToConnect() {
  if (S.files.length === 0) {
    $("dropzone").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  $("peer-input").scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => $("peer-input").focus(), 400);
}

function joinRoom(code) {
  window.myRoom = code;
  socket.emit("join-room", code);
}

function doConnect() {
  const code = $("peer-input").value.trim();
  if (code.length < 4) {
    const inp = $("peer-input");
    inp.classList.add("shake");
    inp.addEventListener("animationend", () => inp.classList.remove("shake"), {
      once: true,
    });
    inp.focus();
    return;
  }

  S.peerCode = code;
  $("bridge").classList.add("visible");
  $("or-sep").style.display = "none";
  $("connect-btn").textContent = "Connecting…";
  $("connect-btn").disabled = true;

  joinRoom(code);
}

function onPeerConnected() {
  const btn = $("connect-btn");

  // LOCK ROOM FEATURE: Scrapes the QR Code and Share Code from the DOM
  // to ensure total privacy once the secure P2P tunnel is established.
  $("code-display").style.display = "none";
  $("or-sep").style.display = "none";
  $("peer-input").parentElement.style.display = "none";
  btn.style.display = "none";

  let lockMsg = $("locked-msg");
  if (!lockMsg) {
    lockMsg = document.createElement("div");
    lockMsg.id = "locked-msg";
    lockMsg.style.textAlign = "center";
    lockMsg.style.padding = "20px";
    lockMsg.style.color = "#15803d";
    lockMsg.style.fontWeight = "600";
    lockMsg.style.background = "rgba(34, 197, 94, 0.1)";
    lockMsg.style.borderRadius = "12px";
    lockMsg.style.marginTop = "10px";
    lockMsg.style.marginBottom = "10px";
    lockMsg.innerHTML = "🔒 Room Locked. Connection is private.";
    $("code-display").parentElement.insertBefore(lockMsg, $("bridge"));
  }

  if (S.files.length > 0) updateSendSection();
}

function onRoomFull() {
  $("bridge").classList.remove("visible");
  $("or-sep").style.display = "";
  $("connect-btn").textContent = "Connect with friend →";
  $("connect-btn").disabled = false;
  $("peer-input").value = "";
  $("peer-input").focus();
  toast("⛔", "Room full", "That code already has 2 people connected.");
}

function showExitModal() {
  $("exit-modal").style.display = "grid";
}
function closeExitModal() {
  $("exit-modal").style.display = "none";
}

// HARD DISCONNECT: Refresh the page for a secure state wipe
function confirmExit() {
  window.location.reload();
}

window.addEventListener("beforeunload", (e) => {
  if (S.connected) {
    e.preventDefault();
    e.returnValue = "";
  }
});

function updateSendSection() {
  if (S.files.length === 0 || !S.connected) return;

  const totalSize = S.files.reduce((acc, f) => acc + f.size, 0);
  const title =
    S.files.length > 1 ? `${S.files.length} files` : S.files[0].name;

  $("send-file-desc").textContent = `${title} · ${fmtBytes(totalSize)} (Ready)`;

  // Solves the "Peer Null" aesthetic bug if a connection is established passively
  const peerName = S.peerCode ? `Peer ${S.peerCode}` : "Peer";
  $("send-peer-desc").textContent = `${peerName} is ready to receive`;

  show("sec-send", "reveal");
  setStep(3);
}

// BATCH SENDING LOGIC
function doSend() {
  if (S.files.length === 0) return;

  hide("send-idle");
  show("send-active");

  S.currentFileIndex = 0;
  sendNextInQueue();
}

function sendNextInQueue() {
  if (S.currentFileIndex >= S.files.length) {
    onBatchComplete();
    return;
  }

  const currentFile = S.files[S.currentFileIndex];

  $("prog-bar").style.width = "0%";
  $("prog-pct").textContent = "0%";
  $("prog-sub").textContent =
    `Sending file ${S.currentFileIndex + 1} of ${S.files.length}: ${currentFile.name}`;
  $("speedo-val").textContent = "0.0 MB/s";
  $("speedo-sub").textContent = "0 B of " + fmtBytes(currentFile.size);
  $("speedo-bar").style.width = "0%";

  const ok = sendFileOverChannel(currentFile);
  if (!ok) {
    show("send-idle");
    hide("send-active");
  }
}

// SOFT RESET: Clears queue and prepares UI for a fresh drop without breaking the WebRTC connection
window.prepareNextTransfer = function () {
  clearFile();

  $("sec-success").style.display = "none";
  $("prog-bar").style.width = "0%";
  $("prog-pct").textContent = "0%";
  $("speedo-bar").style.width = "0%";
  $("peak-spd").textContent = "0";

  const sendBtn = $("send-btn");
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.textContent = "Send this file →";
    sendBtn.style.background = "";
    sendBtn.style.boxShadow = "";
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
};

// REMOTE ABORT LISTENER: Clears queue and returns user to Step 1 safely
window.onRemoteAbort = function () {
  window.prepareNextTransfer();
  toast("⛔", "Cancelled", "The other person stopped the transfer.");
};

// TWO-SIDED ABORT: Sends the network interrupt signal defined in webrtc.js
function doAbort() {
  if (typeof window.notifyAbort === "function") window.notifyAbort();

  // Safely delay the local UI wipe so the abort packet has time to exit the network interface
  setTimeout(() => {
    window.prepareNextTransfer();
    toast("⛔", "Stopped", "You cancelled the transfer.");
  }, 100);
}

function onTransferComplete(role = "sender", origSize = 0, compSize = 0) {
  if (role === "sender") {
    S.batchOrig += origSize;
    S.batchComp += compSize;
    S.currentFileIndex++;
    sendNextInQueue();
  } else {
    // UI Wait State: Pauses the receiver screen until the sender's final telemetry packet arrives
    $("prog-sub").textContent = "Waiting for next file…";
    $("prog-bar").style.width = "100%";
    $("prog-pct").textContent = "100%";
  }
}

// SYNCED DATA SAVED SCREEN: Renders identically across both active devices
window.showSuccessScreen = function (orig, comp, count, role) {
  hide("send-active");
  show("send-idle");

  $("prog-bar").style.width = "0%";
  $("prog-pct").textContent = "0%";
  $("speedo-bar").style.width = "0%";

  const sendBtn = $("send-btn");
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = "✓ Batch sent";
    sendBtn.style.background = "linear-gradient(135deg, #22C55E, #16A34A)";
    sendBtn.style.boxShadow = "0 6px 20px rgba(34,197,94,0.32)";
  }

  const el = $("sec-success");
  el.style.display = "block";

  // Dynamic context generation
  if (role === "sender") {
    document.querySelector(".success-title").textContent = "Delivered!";
    document.querySelector(".success-emoji").textContent = "🎉";
    if (count > 1) {
      $("success-sub").textContent =
        `All ${count} files delivered successfully.`;
    } else {
      $("success-sub").textContent = "File delivered successfully.";
    }
    toast("🎉", "Delivered!", "Transfer complete.");
  } else {
    document.querySelector(".success-title").textContent = "Received!";
    document.querySelector(".success-emoji").textContent = "📥";
    if (count > 1) {
      $("success-sub").textContent = `All ${count} files saved safely.`;
    } else {
      $("success-sub").textContent = "File saved safely.";
    }
    toast("📥", "Received!", "Transfer complete.");
  }

  // ACCURATE DATA SAVED COMPUTATION
  const savedBytes = orig - comp;
  const savedText = savedBytes > 0 ? fmtBytes(savedBytes) : "0 B";
  $("success-saved").textContent =
    `🌱 Smart Engine saved ${savedText} of bandwidth!`;
  $("success-saved").style.display = "block";

  launchConfetti();
};

function onBatchComplete() {
  // Transmit final compression metrics to the receiving peer so their success screen matches
  if (
    typeof dataChannel !== "undefined" &&
    dataChannel &&
    dataChannel.readyState === "open"
  ) {
    dataChannel.send(
      JSON.stringify({
        type: "batch-done",
        orig: S.batchOrig,
        comp: S.batchComp,
        count: S.files.length,
      }),
    );
  }

  // Render sender success screen
  window.showSuccessScreen(S.batchOrig, S.batchComp, S.files.length, "sender");
}

// SVG BRIDGE AND CONFETTI ANIMATIONS
function activateBridge() {
  $("bt-line").classList.add("drawn");
  $("bn-friend").classList.add("lit");

  setTimeout(() => {
    $("bridge-caption").textContent = "✓ Direct connection established";
    $("bridge-caption").classList.add("live");
  }, 1200);

  const svgW = 240;
  const particles = [
    { el: $("bt-p1"), delay: 0, speed: 0.008, phase: 0 },
    { el: $("bt-p2"), delay: 300, speed: 0.012, phase: 0.3 },
    { el: $("bt-p3"), delay: 600, speed: 0.006, phase: 0.6 },
  ];

  particles.forEach((p) => {
    setTimeout(() => {
      let t = p.phase;
      function tick() {
        if (!S.connected) return;
        t = (t + p.speed) % 1;
        const x = t * svgW;
        const y = 15 + Math.sin(t * Math.PI * 2) * 4;
        p.el.setAttribute("cx", x);
        p.el.setAttribute("cy", y);
        p.el.setAttribute("opacity", 0.15 + Math.sin(t * Math.PI) * 0.85);
        requestAnimationFrame(tick);
      }
      tick();
    }, p.delay);
  });
}

function copyCode() {
  const code = $("my-code").textContent;
  navigator.clipboard.writeText(code).catch(() => {});
  const btn = $("copy-btn");
  btn.textContent = "✓ Copied!";
  btn.classList.add("copied");
  setTimeout(() => {
    btn.textContent = "Copy";
    btn.classList.remove("copied");
  }, 2200);
}

function launchConfetti() {
  const canvas = $("fx");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = [
    "#2DD4BF",
    "#22C55E",
    "#F59E0B",
    "#60A5FA",
    "#F472B6",
    "#A78BFA",
  ];
  const pieces = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 60,
    r: 3 + Math.random() * 5,
    dx: (Math.random() - 0.5) * 3,
    dy: 2 + Math.random() * 4,
    rot: Math.random() * 360,
    drot: (Math.random() - 0.5) * 6,
    col: colors[Math.floor(Math.random() * colors.length)],
    alpha: 1,
  }));

  let raf;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    pieces.forEach((p) => {
      p.x += p.dx;
      p.y += p.dy;
      p.rot += p.drot;
      if (p.y > canvas.height * 0.7) p.alpha = Math.max(0, p.alpha - 0.025);
      if (p.alpha > 0) alive = true;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.col;
      ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      ctx.restore();
    });
    if (alive) raf = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  if (raf) cancelAnimationFrame(raf);
  draw();
}

// DYNAMIC QR CODE ENGINE
let qrInstance = null;

function updateQRCode(code) {
  // HARDCODED IP: Guarantees mobile devices can connect to the host machine immediately
  const scanUrl = "http://10.104.223.5:3000/?room=" + code;

  if (!qrInstance) {
    qrInstance = new QRCode($("qrcode"), {
      text: scanUrl,
      width: 70,
      height: 70,
      colorDark: "#18181b",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.L,
    });
  } else {
    qrInstance.clear();
    qrInstance.makeCode(scanUrl);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Always generate this device's unique room code and QR immediately
  const initialCode = wordCode();
  $("my-code").textContent = initialCode;
  updateQRCode(initialCode);

  // Application routing evaluation: Scrape browser URL to identify if session was initiated via camera scan
  const params = new URLSearchParams(window.location.search);
  const scannedRoom = params.get("room");

  if (scannedRoom) {
    $("peer-input").value = scannedRoom;
    window.history.replaceState({}, document.title, window.location.pathname);
    setTimeout(() => {
      jumpToConnect();
      doConnect();
    }, 500);
  }

  show("sec-connect");
  hide("sec-how");
});
