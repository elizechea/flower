// Escritor temporizado sin DOM. Uso: typewrite(texto, { onChar, onSkip, onDone, ... }).
const PAUSE = { '.': 6, '?': 6, '!': 6, '\n': 8 }; // pausa extra, en múltiplos de charDelay

export function typewrite(text, opts = {}) {
  const {
    charDelay = 28,
    pauseAfter = (ch) => (PAUSE[ch] || 0) * charDelay,
    onChar = () => {},
    onSkip = null, // onSkip(resto, desdeIndice): el resto de golpe, sin sonido por carácter
    onDone = () => {},
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = opts;
  const chars = Array.from(text);
  let i = 0, timer = null, finished = false, resolve;
  const done = new Promise((r) => (resolve = r));

  const finish = () => {
    if (finished) return;
    finished = true;
    resolve();
    onDone();
  };
  const stop = () => { clearTimer(timer); timer = null; };
  const skip = () => {
    if (finished) return;
    stop();
    const rest = chars.slice(i);
    const from = i;
    i = chars.length;
    if (rest.length) {
      if (onSkip) onSkip(rest.join(''), from);
      else rest.forEach((ch, k) => onChar(ch, from + k, true));
    }
    finish();
  };
  const cancel = () => {
    if (finished) return;
    finished = true;
    stop();
    resolve();
  };
  const step = () => {
    timer = null;
    const ch = chars[i];
    onChar(ch, i++, false);
    if (i >= chars.length) return finish();
    timer = setTimer(step, charDelay + pauseAfter(ch));
  };

  if (charDelay <= 0 || !chars.length) {
    // charDelay 0 = instantáneo; síncrono
    if (charDelay <= 0) skip(); else finish();
  } else {
    timer = setTimer(step, 0);
  }
  return { skip, cancel, done };
}
