// Sonidos sintetizados (spec §8). Nunca lanza; sin AudioContext degrada en silencio.
const MUTE_KEY = 'terminal:muted';
const MAX_ACTIVE = 6; // polifonía máxima de blips de tecleo
const MIN_GAP = 0.02; // s entre blips de tecleo

let ctx = null;
let active = 0;
let lastBlip = -1;
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* sin storage */ }

function getCtx() {
  if (ctx) return ctx;
  try {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (AC) ctx = new AC();
  } catch { ctx = null; }
  return ctx;
}

// Una nota: oscilador -> ganancia -> salida; ataque 2 ms, decay exponencial, se desconecta al acabar.
function tone({ freq, end = freq, dur = 0.04, type = 'square', gain = 0.05, at = 0, counted = false }) {
  const c = getCtx();
  if (!c || muted) return;
  try {
    const t = c.currentTime + at;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (end !== freq) osc.frequency.exponentialRampToValueAtTime(end, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(c.destination);
    if (counted) active++;
    osc.onended = () => {
      try { osc.disconnect(); g.disconnect(); } catch { /* ya desconectado */ }
      if (counted) active--;
    };
    osc.start(t);
    osc.stop(t + dur + 0.01);
  } catch { /* nunca lanza */ }
}

/** Crea/reanuda el contexto; llamar en el primer gesto del usuario. */
export function unlock() {
  try {
    const c = getCtx();
    if (c && c.state === 'suspended') c.resume();
  } catch { /* silencio */ }
}

/** Blip de teletipo para un carácter visible. */
export function blip(ch) {
  if (typeof ch === 'string' && ch.trim() === '') return;
  const c = getCtx();
  if (!c || muted || active >= MAX_ACTIVE) return;
  if (c.currentTime - lastBlip < MIN_GAP) return;
  lastBlip = c.currentTime;
  tone({ freq: (1800 + Math.random() * 800) * (0.92 + Math.random() * 0.16), dur: 0.03 + Math.random() * 0.015, counted: true });
}

/** Pulsación de botón: más grave. */
export function click() {
  tone({ freq: 600, dur: 0.05, gain: 0.06 });
  try { if (!muted && globalThis.navigator?.vibrate) globalThis.navigator.vibrate(5); } catch { /* silencio */ }
}

export function optionsAppear() {
  tone({ freq: 2000, dur: 0.035 });
  tone({ freq: 2400, dur: 0.035, at: 0.07 });
}

export function goodEnding() {
  [523, 659, 784, 1047].forEach((freq, i) => tone({ freq, dur: 0.14, type: 'triangle', gain: 0.07, at: i * 0.12 }));
}

export function badEnding() {
  tone({ freq: 220, end: 55, dur: 0.7, type: 'sawtooth', gain: 0.07 });
}

export function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* sin storage */ }
}

export function isMuted() { return muted; }
