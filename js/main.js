// Arranque: cableado de módulos y router por hash.
import { parseHash, hashFor } from './router.js';
import { createStorage } from './session/storage.js';
import { createSessionStore, newSessionId } from './session/session.js';
import { createTerminal } from './ui/terminal.js';
import { showHome, startGame } from './ui/views.js';
import { createMenu } from './ui/menu.js';
import * as audio from './audio/blip.js';
import { t } from './i18n/es.js';

const $ = (id) => document.getElementById(id);
const storage = createStorage();
const store = createSessionStore(storage);
const terminal = createTerminal({ log: $('log'), options: $('options'), screen: $('screen'), getSpeed: () => store.getSettings().speed });
audio.setMuted(!store.getSettings().sound);

let view = null; // vista activa: { stop, restart? }
let run = 0;
let unlocked = false;
const menu = createMenu({ el: $('menu'), app: $('app'), store, getGame: () => (view && view.restart ? view : null) });

// Catálogo e historias (rutas relativas: funciona bajo subruta de GitHub Pages).
let index = null;
const stories = new Map();
const fetchJson = (path) => fetch(path).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${path}`))));
const loadIndex = () => (index ||= fetchJson('stories/index.json').then((j) => j.stories).catch((e) => { index = null; throw e; }));
function loadStory(id) {
  if (!stories.has(id)) {
    stories.set(id, loadIndex().then((list) => {
      const entry = list.find((s) => s.id === id);
      return entry ? fetchJson('stories/' + entry.file) : Promise.reject(new Error('historia desconocida: ' + id));
    }).catch((e) => { stories.delete(id); throw e; }));
  }
  return stories.get(id);
}

async function route() {
  const r = parseHash(location.hash);
  const my = ++run;
  view?.stop();
  view = null;
  menu.close();
  if (r.name === 'new') return location.replace(hashFor({ name: 'play', storyId: r.storyId, sessionId: newSessionId() }));
  try {
    if (r.name === 'home') {
      const list = await loadIndex();
      if (my !== run) return;
      view = showHome({ terminal, store, storage, stories: list, loadStory, isUnlocked: () => unlocked });
    } else {
      const story = await loadStory(r.storyId);
      if (my !== run) return;
      view = startGame({ terminal, store, storage, story, sessionId: r.sessionId, hashLog: r.log });
    }
  } catch (e) {
    if (my !== run) return;
    console.warn(e);
    terminal.clear();
    terminal.notice(t(r.name === 'home' ? 'error.storiesLoad' : 'error.storyLoad'));
    terminal.buttons([{ label: t('ending.retry'), testid: 'retry', onClick: route }, { label: t('ending.otherStories'), testid: 'other-stories', onClick: () => { location.hash = '#/'; } }]);
  }
}

// Audio: desbloqueo en el primer gesto (política de autoplay). En captura, para que el contexto exista
// antes de que ese mismo gesto (p. ej. saltar el tecleo) haga sonar algo.
const unlock = () => { audio.unlock(); unlocked = true; };
document.addEventListener('pointerdown', unlock, { once: true, capture: true });
document.addEventListener('keydown', unlock, { once: true, capture: true });

$('screen').addEventListener('pointerdown', () => terminal.skip());
$('menu-btn').addEventListener('click', () => { audio.click(); menu.toggle(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') return menu.toggle();
  if (menu.isOpen()) return;
  if ((e.key === ' ' || e.key === 'Enter') && terminal.isTyping()) { e.preventDefault(); terminal.skip(); return; }
  if (/^[1-4]$/.test(e.key)) {
    const b = $('options').querySelectorAll('button[data-option-id]')[+e.key - 1];
    if (b && !b.disabled) b.click();
  }
});

window.addEventListener('hashchange', route);
route();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
