/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const S = {
  files: [],
  currentFileIndex: 0,
  connected: false,
  peerCode: null,
  firstFile: true,
  peak: 0,
  sendTimer: null,
  batchOrig: 0, // ✨ NEW: Tracks total original bytes across all files
  batchComp: 0, // ✨ NEW: Tracks total compressed network bytes across all files
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DOM HELPERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   UTILITY FUNCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TOAST NOTIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function toast(icon, title, sub = "") {
  $("toast-icon").textContent = icon;
  $("toast-title").textContent = title;
  $("toast-sub").textContent = sub;
  const t = $("toast");
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3500);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   STEPPER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DRAG & DROP HANDLERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function onDragOver(e) {
  e.preventDefault();
  if (S.files.length === 0) {
    $("dropzone").classList.add("drag-over");
    const dropEmoji = $("drop-emoji");
    if (dropEmoji) dropEmoji.textContent = "📥";
  }
}

function onDragLeave() {
  $("dropzone").classList.remove("drag-over");
  const dropEmoji = $("drop-emoji");
  if (dropEmoji) dropEmoji.textContent = "📂";
}

function onDrop(e) {
  e.preventDefault();
  $("dropzone").classList.remove("drag-over");
  if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
}

function onDropzoneClick() {
  $("file-input").click();
}

function onFileSelect(e) {
  if (e.target.files.length > 0) {
    processFiles(e.target.files);
    e.target.value = "";
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PROCESS MULTIPLE FILES (APPEND MODE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
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

  // Deduplicate: filter out files already in S.files by name+size
  const existingKeys = new Set(S.files.map(f => f.name + ":" + f.size));
  const uniqueNew = Array.from(fileList).filter(
    f => !existingKeys.has(f.name + ":" + f.size)
  );

  const duplicateCount = fileList.length - uniqueNew.length;
  if (duplicateCount > 0) {
    toast("⚠️", "Duplicate skipped", `${duplicateCount} file(s) already in queue.`);
  }

  if (uniqueNew.length === 0) return;

  // Append new (unique) files
  S.files = [...S.files, ...uniqueNew];
  S.currentFileIndex = 0;

  // Reset the global counters for the new batch
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
    <span class="chip chip-green">Smart Engine⚡</span>
  `;

  show("sec-compression");
  $("c-pct").innerHTML = `<span style="font-size: 32px">Live⚡</span>`;
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
  // Revoke any object URLs to prevent memory leaks
  S.files.forEach(f => { if (f._objectURL) URL.revokeObjectURL(f._objectURL); });

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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CONNECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function jumpToConnect() {
  if (S.files.length === 0) {
    $("dropzone").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  $("peer-input").scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => $("peer-input").focus(), 400);
}

function joinRoom(code) {
  myRoom = code;
  socket.emit("join-room", code);
  console.log("Joining room:", code);
}

function doConnect() {
  const raw = $("peer-input").value.trim().toUpperCase();

  // Accept both word-number format (PINE-1234) and raw 4+ char codes
  if (raw.length < 4) {
    const inp = $("peer-input");
    inp.classList.add("shake");
    inp.addEventListener("animationend", () => inp.classList.remove("shake"), {
      once: true,
    });
    inp.focus();
    toast("⚠️", "Invalid code", "Enter your friend's share code first.");
    return;
  }

  // Prevent connecting to your own code
  if (raw === $("my-code").textContent.trim().toUpperCase()) {
    const inp = $("peer-input");
    inp.classList.add("shake");
    inp.addEventListener("animationend", () => inp.classList.remove("shake"), {
      once: true,
    });
    toast("🤔", "That's your own code", "Enter your friend's code, not yours.");
    return;
  }

  S.peerCode = raw;
  $("bridge").classList.add("visible");
  $("or-sep").style.display = "none";
  $("connect-btn").textContent = "Connecting…";
  $("connect-btn").disabled = true;

  // Connection timeout — show specific error after 15s
  S._connectTimeout = setTimeout(() => {
    if (!S.connected) {
      $("connect-btn").textContent = "Connect with friend →";
      $("connect-btn").disabled = false;
      $("bridge").classList.remove("visible");
      $("or-sep").style.display = "";
      toast("⏱️", "Network timeout", "Could not reach peer. Check the code and try again.");
    }
  }, 15000);

  joinRoom(raw);
}

function onPeerConnected() {
  // Clear the timeout since we connected successfully
  if (S._connectTimeout) {
    clearTimeout(S._connectTimeout);
    S._connectTimeout = null;
  }

  const btn = $("connect-btn");
  btn.textContent = "✓ Connected";
  btn.style.background = "linear-gradient(135deg, #22C55E, #16A34A)";
  btn.style.boxShadow = "0 6px 20px rgba(34,197,94,0.32)";
  btn.disabled = false;

  $("code-display").classList.add("pulse-glow");
  setTimeout(() => $("code-display").classList.remove("pulse-glow"), 2000);
}

function onRoomFull() {
  if (S._connectTimeout) {
    clearTimeout(S._connectTimeout);
    S._connectTimeout = null;
  }
  $("bridge").classList.remove("visible");
  $("or-sep").style.display = "";
  $("connect-btn").textContent = "Connect with friend →";
  $("connect-btn").disabled = false;
  $("peer-input").value = "";
  $("peer-input").focus();
  toast("⛔", "Peer offline or invalid", "Double-check the code — the room is full or doesn't exist.");
}

function showExitModal() {
  $("exit-modal").style.display = "grid";
}
function closeExitModal() {
  $("exit-modal").style.display = "none";
}
function confirmExit() {
  closeExitModal();
  doReset();
}

window.addEventListener("beforeunload", (e) => {
  if (S.connected) {
    e.preventDefault();
    e.returnValue = "";
  }
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   UPDATE SEND SECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function updateSendSection() {
  if (S.files.length === 0 || !S.connected) return;

  const totalSize = S.files.reduce((acc, f) => acc + f.size, 0);
  const title =
    S.files.length > 1 ? `${S.files.length} files` : S.files[0].name;

  $("send-file-desc").textContent = `${title} · ${fmtBytes(totalSize)} (Ready)`;
  $("send-peer-desc").textContent = `Peer ${S.peerCode} is ready to receive`;

  show("sec-send", "reveal");
  setStep(3);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   QUEUE SENDER LOOP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ABORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function doAbort() {
  if (S.sendTimer) {
    clearInterval(S.sendTimer);
    S.sendTimer = null;
  }
  hide("send-active");
  show("send-idle");
  $("prog-bar").style.width = "0%";
  $("prog-pct").textContent = "0%";
  $("speedo-bar").style.width = "0%";
  toast("⛔", "Transfer stopped", "You can try again.");
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TRANSFER COMPLETE (SINGLE FILE vs BATCH)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
// ✨ NEW: This now receives the byte math from webrtc.js!
function onTransferComplete(role = "sender", origSize = 0, compSize = 0) {
  if (role === "sender") {
    console.log(`✅ File ${S.currentFileIndex + 1} complete.`);

    // Add this file's stats to the total batch tally
    S.batchOrig += origSize;
    S.batchComp += compSize;

    S.currentFileIndex++;
    sendNextInQueue();
  } else {
    toast("📥", "File received!", "Saved successfully.");
  }
}

function onBatchComplete() {
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

  document.querySelector(".success-title").textContent = "Delivered!";
  document.querySelector(".success-emoji").textContent = "🎉";
  $("success-sub").textContent =
    `All ${S.files.length} files delivered successfully.`;

  // ✨ CALCULATE AND SHOW THE SAVINGS MATH ✨
  const savedBytes = S.batchOrig - S.batchComp;
  if (savedBytes > 0) {
    $("success-saved").textContent =
      `🌱 Smart Engine saved ${fmtBytes(savedBytes)} of bandwidth!`;
    $("success-saved").style.display = "block";
  } else {
    $("success-saved").style.display = "none";
  }

  toast("🎉", "Delivered!", "Entire batch sent.");
  launchConfetti();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   RESET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function doReset() {
  const wasConnected = S.connected;
  clearFile();

  if (S.sendTimer) {
    clearInterval(S.sendTimer);
    S.sendTimer = null;
  }
  S.peak = 0;

  $("sec-success").style.display = "none";
  hide("send-active");
  show("send-idle");
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

  if (wasConnected) {
    show("sec-connect");
    hide("sec-how");
    hide("sec-send");
    setStep(2);
  } else {
    S.connected = false;
    S.peerCode = null;

    if (typeof pc !== "undefined" && pc) {
      pc.close();
      pc = null;
    }
    if (typeof dataChannel !== "undefined" && dataChannel) {
      dataChannel.close();
      dataChannel = null;
    }

    $("connDot").className = "conn-dot";
    $("connText").textContent = "Not connected";
    $("peer-input").value = "";
    $("peer-input").disabled = false;

    const btn = $("connect-btn");
    btn.textContent = "Connect with friend →";
    btn.style.background = "";
    btn.style.boxShadow = "";
    btn.disabled = false;

    $("bridge").classList.remove("visible");
    $("or-sep").style.display = "";
    $("bt-line").classList.remove("drawn");
    $("bn-friend").classList.remove("lit");
    $("bridge-caption").textContent = "Establishing link…";
    $("bridge-caption").className = "bridge-caption";

    $("my-code").textContent = wordCode();
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SVG BRIDGE & CONFETTI ANIMATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
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

document.addEventListener("DOMContentLoaded", () => {
  $("my-code").textContent = wordCode();
  show("sec-connect");
  hide("sec-how");

  // Apply spring animation to all primary buttons on click
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-primary, .btn-danger");
    if (btn && !btn.disabled) {
      btn.classList.remove("spring");
      void btn.offsetWidth; // reflow to restart animation
      btn.classList.add("spring");
      btn.addEventListener("animationend", () => btn.classList.remove("spring"), { once: true });
    }
  });

  // Apply scale:0.98 active feedback to glass buttons on mobile
  document.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest(".btn-glass");
    if (btn && !btn.disabled) {
      btn.style.transform = "scale(0.98)";
      const up = () => { btn.style.transform = ""; document.removeEventListener("pointerup", up); };
      document.addEventListener("pointerup", up);
    }
  });
});