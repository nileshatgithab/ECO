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

