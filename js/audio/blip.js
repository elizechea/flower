// Sonidos sintetizados (spec §8). Nunca lanza; sin AudioContext degrada en silencio.
// El contexto solo nace en unlock() (primer gesto del usuario); antes no se programa nada.
const MAX_ACTIVE = 6; // polifonía máxima de blips de tecleo
const MIN_GAP = 0.02; // s entre blips de tecleo
const APPLE_HZ = 1000; // el pitido del Apple II ronda 1 kHz

let ctx = null;
let active = 0;
let lastBlip = -1;
let muted = false;

// Una nota: oscilador -> ganancia -> salida; ataque 2 ms, decay exponencial, se desconecta al acabar.
function tone({ freq, end = freq, dur = 0.04, type = 'square', gain = 0.05, at = 0, counted = false, flat = false }) {
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
    // flat: encendido/apagado como un altavoz de 1 bit (solo 2 ms de rampa para evitar chasquidos)
    if (flat) { g.gain.setValueAtTime(gain, t + dur - 0.002); g.gain.linearRampToValueAtTime(0.0001, t + dur); }
    else g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
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

// Ráfaga de ruido blanco filtrado (paso banda). Sin createBuffer (navegadores viejos o espías) no suena.
let noiseBuf = null;
function noise({ freq, dur, gain, at = 0 }) {
  const c = ctx;
  if (!c || muted || !c.createBuffer || !c.createBufferSource || !c.createBiquadFilter) return;
  try {
    if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
      noiseBuf = c.createBuffer(1, Math.ceil(c.sampleRate * 0.05), c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; // se genera una vez: suena siempre igual
    }
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    src.buffer = noiseBuf;
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    f.Q.setValueAtTime(1.2, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.onended = () => { try { src.disconnect(); f.disconnect(); g.disconnect(); } catch { /* ya desconectado */ } };
    src.start(t);
    src.stop(t + dur + 0.01);
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

/** Altavoz de 1 bit del Apple II: onda cuadrada a tono fijo, plana y corta. Siempre igual. */
export function blip(ch) {
  if (!canType(ch)) return;
  tone({ freq: APPLE_HZ, dur: 0.025, gain: 0.07, flat: true, counted: true });
}

/** Tecla de teclado mecánico: chasquido de ruido filtrado + golpe grave del fondo de la tecla. */
export function keypress(ch) {
  if (!canType(ch)) return;
  noise({ freq: 3500, dur: 0.012, gain: 0.5 }); // clic del interruptor
  tone({ freq: 150, end: 70, dur: 0.04, type: 'sine', gain: 0.3, counted: true }); // golpe ("thock")
  noise({ freq: 1200, dur: 0.02, gain: 0.25, at: 0.012 }); // tope de la tecla
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
