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
