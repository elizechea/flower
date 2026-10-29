// Pantalla de terminal: tecleo con blip por carácter, cursor, auto-scroll, opciones y bloque de final.
import { typewrite } from './typewriter.js';
import * as audio from '../audio/blip.js';
import { t } from '../i18n/es.js';

const SPEED_MS = { veryslow: 90, slow: 55, normal: 28, fast: 12, instant: 0 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createTerminal({ log, options, screen, getSpeed = () => 'veryslow' }) {
  let current = null; // typewriter en curso
  let skipped = false; // tras saltar, el resto del nodo sale al instante (hasta que aparezcan botones)

  const scroll = () => { screen.scrollTop = screen.scrollHeight; };
  const setTyping = (on) => { document.body.dataset.typing = on ? '1' : '0'; };
  const setCursor = (el) => {
    log.querySelector('.cursor')?.classList.remove('cursor');
    el.classList.add('cursor');
  };
  const line = (cls, text = '') => {
    const p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    log.appendChild(p);
    setCursor(p);
    scroll();
    return p;
  };

  // Teclea `text` en una línea nueva. El texto completo va en un span oculto visualmente
  // para que el lector de pantalla lo tenga entero desde el principio. Devuelve null si se canceló.
  async function type(text, cls = 'txt', factor = 1, sound = audio.blip) {
    const p = line(cls);
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    const vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    p.append(sr, vis);
    setTyping(true);
    let finished = false; // cancel() resuelve `done` sin llamar a onDone
    const tw = typewrite(text, {
      charDelay: skipped ? 0 : Math.round(SPEED_MS[getSpeed()] * factor),
      onChar(ch) { vis.textContent += ch; sound(ch); scroll(); },
      onSkip(rest) { vis.textContent += rest; scroll(); },
      onDone() { finished = true; },
    });
    current = tw;
    await tw.done;
    if (current === tw) current = null;
    setTyping(false);
    vis.remove();
    sr.className = ''; // cambiar la clase no re-anuncia el texto
    return finished ? p : null;
  }

  function buttons(items) {
    skipped = false;
    options.replaceChildren();
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.testid = it.testid;
      if (it.id) b.dataset.optionId = it.id;
      b.style.setProperty('--i', i);
      b.textContent = it.label;
      b.disabled = !!it.disabled;
      b.onclick = () => { audio.click(); options.replaceChildren(); it.onClick(); };
      options.appendChild(b);
    });
    scroll();
  }

  return {
    clear() {
      this.cancel();
      log.replaceChildren();
      options.replaceChildren();
    },
    cancel() { current?.cancel(); current = null; skipped = false; setTyping(false); },
    skip() { if (current) { skipped = true; current.skip(); } },
    isTyping: () => current !== null,
    type,
    print: (text, cls = 'txt') => line(cls, text),
    notice: (text) => line('notice', text),
    echo: (label, instant) => (instant ? line('echo', label) : type(label, 'echo', 1.5, audio.keypress)),
    async processing(ms = 400) {
      skipped = false; // frontera entre el eco saltado y el nodo siguiente, que sí se teclea
      const p = line('processing', t('ui.processing'));
      const dots = setInterval(() => { p.textContent += '.'; }, ms / 4);
      await wait(ms);
      clearInterval(dots);
      p.remove();
    },
    // silent: al restaurar una partida las opciones se pintan sin sonido (spec §6).
    showOptions(opts, onChoose, silent) {
      buttons(opts.map((o, i) => ({
        id: o.id,
        testid: 'option',
        label: `[${i + 1}] ${o.label}${o.locked ? ' ' + t('stories.locked') : ''}`,
        disabled: !!o.locked,
        onClick: () => onChoose(o),
      })));
      if (!silent) audio.optionsAppear();
    },
    buttons,
    async ending(ending, instant) {
      const fin = t('ending.title', { title: ending.title });
      const box = document.createElement('div');
      box.className = 'ending';
      box.dataset.testid = 'ending';
      box.dataset.endingType = ending.type;
      log.appendChild(box);
      const p = instant ? line('fin', fin) : await type(fin, 'fin', 0.5);
      if (!p) return; // cancelado (cambio de vista) mientras tecleaba el título
      box.appendChild(p);
      box.appendChild(line('tag', t('ending.' + ending.type)));
      if (!instant) (ending.type === 'bad' ? audio.badEnding : audio.goodEnding)();
    },
  };
}
