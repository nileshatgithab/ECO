/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const S = {
  file:      null,
  ratio:     0.7,
  connected: false,
  peerCode:  null,
  firstFile: true,
  peak:      0,
  ticker:    null,
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DOM HELPERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const $ = id => document.getElementById(id);

const show = (id, animClass = '') => {
  const el = $(id);
  el.style.display = '';
  if (animClass) {
    el.classList.remove(animClass);
    void el.offsetWidth; // reflow to restart animation
    el.classList.add(animClass);
  }
};

const hide = id => $(id).style.display = 'none';


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   UTILITY FUNCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function fmtBytes(b) {
  if (!b || b === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return (b / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

function fileEmoji(type) {
  if (!type) return '📁';
  if (type.includes('image'))      return '🖼️';
  if (type.includes('pdf'))        return '📋';
  if (type.includes('video'))      return '🎬';
  if (type.includes('audio'))      return '🎵';
  if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return '📦';
  if (type.includes('text') || type.includes('json') || type.includes('javascript') || type.includes('html') || type.includes('css')) return '📝';
  return '📁';
}

function fileType(type) {
  if (!type) return 'File';
  const map = {
    'json': 'JSON', 'javascript': 'JavaScript', 'text/plain': 'Text',
    'html': 'HTML', 'css': 'CSS',
    'image/jpeg': 'JPEG', 'image/jpg': 'JPEG', 'image/png': 'PNG',
    'image/gif': 'GIF', 'image/webp': 'WebP',
    'pdf': 'PDF', 'zip': 'ZIP', 'video/mp4': 'MP4', 'audio': 'Audio',
  };
  for (const [key, val] of Object.entries(map)) {
    if (type.includes(key)) return val;
  }
  return (type.split('/')[1] || 'File').toUpperCase();
}

function compressionRatio(type) {
  if (!type) return 0.72;
  if (type.includes('text') || type.includes('json') || type.includes('javascript') || type.includes('html') || type.includes('css'))
    return 0.33 + Math.random() * 0.19;
  if (type.includes('image/jpeg') || type.includes('video') || type.includes('audio'))
    return 0.91 + Math.random() * 0.06;
  if (type.includes('zip') || type.includes('rar'))
    return 0.96 + Math.random() * 0.03;
  return 0.60 + Math.random() * 0.24;
}

function estTime(bytes) {
  const secs = (bytes * 8) / 1500000;
  if (secs < 3)  return '< 3 sec';
  if (secs < 60) return '~' + Math.ceil(secs) + 's';
  return '~' + Math.ceil(secs / 60) + 'min';
}

function wordCode() {
  const words = ['PINE','MINT','SAGE','OPAL','DUSK','TIDE','FERN','DOVE','WREN','REEF','COVE','MIST','GLOW','LARK','ARCH'];
  return words[Math.floor(Math.random() * words.length)] + '-' + (Math.floor(Math.random() * 9000) + 1000);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TOAST NOTIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function toast(icon, title, sub = '') {
  $('toast-icon').textContent  = icon;
  $('toast-title').textContent = title;
  $('toast-sub').textContent   = sub;
  const t = $('toast');
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   STEPPER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function setStep(n) {
  for (let i = 1; i <= 3; i++) {
    const el = $('s' + i);
    el.classList.remove('active', 'done');
    if (i < n)      el.classList.add('done');
    else if (i === n) el.classList.add('active');
  }
  $('sc1').className = 'step-connector' + (n > 1 ? ' done' : n === 1 ? ' active' : '');
  $('sc2').className = 'step-connector' + (n > 2 ? ' done' : n === 2 ? ' active' : '');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DRAG & DROP HANDLERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function onDragOver(e) {
  e.preventDefault();
  if (!S.file) $('dropzone').classList.add('drag-over');
}

function onDragLeave() {
  $('dropzone').classList.remove('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  $('dropzone').classList.remove('drag-over');
  if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
}

function onDropzoneClick() {
  if (S.file) return;
  $('file-input').click();
}

function onFileSelect(e) {
  if (e.target.files[0]) processFile(e.target.files[0]);
}


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PROCESS FILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function processFile(file) {
  S.file  = file;
  S.ratio = compressionRatio(file.type);
 
  const comp  = Math.floor(file.size * S.ratio);
  const saved = Math.round((1 - S.ratio) * 100);
  const emoji = fileEmoji(file.type);
  const isImg = file.type.startsWith('image/');
 
  // ── Update drop zone ──
  $('dropzone').classList.add('loaded');
  hide('empty-state');
  $('file-row').style.display = 'flex';
 
  // Real image thumbnail or emoji
  if (isImg) {
    const url = URL.createObjectURL(file);
    $('drop-hero').innerHTML  = `<img src="${url}" alt="preview"/>`;
    $('file-thumb').innerHTML = `<img src="${url}" alt="thumb"/>`;
  } else {
    $('drop-hero').innerHTML  = `<span>${emoji}</span>`;
    $('file-thumb').innerHTML = `<span>${emoji}</span>`;
  }
 
  $('file-name').textContent = file.name;
  $('file-meta').textContent = fileType(file.type) + ' · ' + fmtBytes(file.size);
  $('file-chips').innerHTML  = `
    <span class="chip chip-teal">✓ Loaded</span>
    <span class="chip chip-green">−${saved}% smaller</span>
  `;
 
  // ── Compression snapshot ──
  show('sec-compression');
  $('c-pct').innerHTML    = saved + '<sup>%</sup>';
  $('c-detail').innerHTML = `<strong>${fmtBytes(file.size)}</strong> → <strong>${fmtBytes(comp)}</strong> · ${Math.round((1 / S.ratio) * 10) / 10}× faster to send`;
  $('s-orig').textContent  = fmtBytes(file.size);
  $('s-comp').textContent  = fmtBytes(comp);
  $('s-time').textContent  = estTime(comp);
  $('s-saved').textContent = fmtBytes(file.size - comp);
 
  // ── Progressive disclosure: reveal connect card ──
  show('sec-connect');
  hide('sec-how');
 
  // ── Advance stepper ──
  setStep(2);
 
  // ── First-run coach mark ──
  if (S.firstFile) {
    S.firstFile = false;
    setTimeout(() => $('coach1').classList.add('on'), 600);
  }
 
  // If already connected, show send section immediately
  if (S.connected) updateSendSection();
 
  toast(emoji, 'File ready', file.name + ' — shrunk by ' + saved + '%');
}
 
function clearFile() {
  // Revoke any blob URLs to free memory
  ['drop-hero', 'file-thumb'].forEach(id => {
    const img = $(id).querySelector('img');
    if (img) URL.revokeObjectURL(img.src);
  });
 
  S.file = null;
 
  $('dropzone').classList.remove('loaded');
  show('empty-state');
  hide('sec-compression');
  hide('sec-connect');
  hide('sec-send');
  show('sec-how');
  $('file-row').style.display = 'none';
  $('file-input').value = '';
  $('drop-hero').innerHTML = '<span id="drop-emoji">📂</span>';
  $('coach1').classList.remove('on');
 
  setStep(1);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CONNECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function jumpToConnect() {
  if (!S.file) {
    $('dropzone').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  $('peer-input').scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => $('peer-input').focus(), 400);
}
 
function doConnect() {
  const code = $('peer-input').value.trim();
 
  // Validate: must have at least 4 characters
  if (code.length < 4) {
    const inp = $('peer-input');
    inp.classList.add('shake');
    inp.addEventListener('animationend', () => inp.classList.remove('shake'), { once: true });
    inp.focus();
    return;
  }
 
  S.peerCode = code;
 
  const btn    = $('connect-btn');
  btn.disabled = true;
  btn.textContent = 'Connecting…';
 
  // Header badge → searching state
  $('connDot').className    = 'conn-dot searching';
  $('connText').textContent = 'Looking…';
 
  // Show the visual bridge immediately
  $('bridge').classList.add('visible');
  $('or-sep').style.display   = 'none';
  $('bridge-caption').textContent = 'Establishing link…';
  $('bridge-caption').className   = 'bridge-caption';
 
  // Simulate connection after 1.9 seconds
  setTimeout(() => {
    S.connected = true;
 
    // Header badge → connected
    $('connDot').className    = 'conn-dot live';
    $('connText').textContent = 'Connected';
 
    // Button → success state
    btn.textContent    = '✓ Connected';
    btn.style.background  = 'linear-gradient(135deg, #22C55E, #16A34A)';
    btn.style.boxShadow   = '0 6px 20px rgba(34,197,94,0.32)';
    btn.disabled = false;
 
    // Pulse the share code display
    $('code-display').classList.add('pulse-glow');
    setTimeout(() => $('code-display').classList.remove('pulse-glow'), 2000);
 
    // Animate the beam bridge
    activateBridge();
 
    toast('🔗', 'Connected!', 'Direct encrypted link to ' + code + ' established.');
 
    if (S.file) updateSendSection();
  }, 1900);
}
 
/* ── Animate the SVG connection beam ── */
function activateBridge() {
  // Draw the beam line
  $('bt-line').classList.add('drawn');
 
  // Light up the friend node
  $('bn-friend').classList.add('lit');
  $('bn-friend-icon').style.display = 'none';
 
  // Update caption after line finishes drawing
  setTimeout(() => {
    $('bridge-caption').textContent = '✓ Direct connection established';
    $('bridge-caption').classList.add('live');
  }, 1200);
 
  // Launch three orbiting particles along a sine-wave path
  const svgW = 240;
  const particles = [
    { el: $('bt-p1'), delay: 0,   speed: 0.008, phase: 0   },
    { el: $('bt-p2'), delay: 300, speed: 0.012, phase: 0.3 },
    { el: $('bt-p3'), delay: 600, speed: 0.006, phase: 0.6 },
  ];
 
  particles.forEach(p => {
    setTimeout(() => {
      let t = p.phase;
      function tick() {
        if (!S.connected) return; // stop when disconnected
        t = (t + p.speed) % 1;
        const x = t * svgW;
        const y = 15 + Math.sin(t * Math.PI * 2) * 4; // gentle sine wave
        p.el.setAttribute('cx', x);
        p.el.setAttribute('cy', y);
        p.el.setAttribute('opacity', 0.15 + Math.sin(t * Math.PI) * 0.85);
        requestAnimationFrame(tick);
      }
      tick();
    }, p.delay);
  });
}
 
function copyCode() {
  const code = $('my-code').textContent;
  navigator.clipboard.writeText(code).catch(() => {});
  const btn = $('copy-btn');
  btn.textContent = '✓ Copied!';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = 'Copy';
    btn.classList.remove('copied');
  }, 2200);
}
 