// Sonidos sintetizados (spec §8). Nunca lanza; sin AudioContext degrada en silencio.
// El contexto solo nace en unlock() (primer gesto del usuario); antes no se programa nada.
const MAX_ACTIVE = 6; // polifonía máxima de blips de tecleo
const MIN_GAP = 0.02; // s entre blips de tecleo

let ctx = null;
let active = 0;
let lastBlip = -1;
let muted = false;

// Una nota: oscilador -> ganancia -> salida; ataque 2 ms, decay exponencial, se desconecta al acabar.
function tone({ freq, end = freq, dur = 0.04, type = 'square', gain = 0.05, at = 0, counted = false }) {
  const c = ctx;
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
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!ctx && AC) ctx = new AC();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  } catch { ctx = null; }
}

// Devuelve false si el carácter no suena (espacio) o hay que limitar la polifonía.
function canType(ch) {
  if (typeof ch === 'string' && ch.trim() === '') return false;
  const c = ctx;
  if (!c || muted || active >= MAX_ACTIVE || c.currentTime - lastBlip < MIN_GAP) return false;
  lastBlip = c.currentTime;
  return true;
}

/** Pitido de ordenador de los 80 (altavoz interno) por cada carácter que escribe el sistema. */
export function blip(ch) {
  if (!canType(ch)) return;
  const f = (900 + Math.random() * 400) * (0.92 + Math.random() * 0.16);
  tone({ freq: f, end: f * 0.85, dur: 0.035 + Math.random() * 0.01, gain: 0.09, counted: true });
}

/** Tecla mecánica para lo que escribe el jugador: golpe grave + chasquido agudo. */
export function keypress(ch) {
  if (!canType(ch)) return;
  tone({ freq: 220 * (0.9 + Math.random() * 0.2), end: 90, dur: 0.045, gain: 0.16, counted: true });
  tone({ freq: 3200 + Math.random() * 600, dur: 0.012, gain: 0.07 });
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

/** Silencio en memoria; la persistencia vive en los ajustes (terminal:v1:settings). */
export function setMuted(v) { muted = !!v; }

export function isMuted() { return muted; }
