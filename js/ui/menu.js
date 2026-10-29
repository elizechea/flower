// Menú ☰: overlay a pantalla completa (§7). Ajustes en terminal:v1:settings vía store.
import * as audio from '../audio/blip.js';
import { t } from '../i18n/es.js';

const SPEEDS = ['slow', 'normal', 'fast', 'instant'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export function createMenu({ el, app, store, getGame }) {
  let about = false;
  let msg = '';

  const add = (key, label, onClick, disabled = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.testid = 'menu-' + key;
    b.textContent = label;
    b.disabled = disabled;
    b.onclick = () => { audio.click(); onClick(); };
    el.appendChild(b);
  };
  const para = (cls, text) => {
    const p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    el.appendChild(p);
  };

  async function share() {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: document.title, url });
      else { await navigator.clipboard.writeText(url); msg = t('ui.linkCopied'); render(); }
    } catch { /* cancelado por el usuario o sin permiso */ }
  }

  function render() {
    el.replaceChildren();
    const s = store.getSettings();
    const game = getGame();
    add('continue', t('menu.continue'), close);
    if (game) add('restart', t('menu.restart'), () => { close(); game.restart(); });
    add('change-story', t('menu.changeStory'), () => { close(); location.hash = '#/'; });
    add('sound', s.sound ? t('menu.soundOn') : t('menu.soundOff'), () => {
      store.saveSettings({ sound: !s.sound });
      audio.setMuted(s.sound);
      render();
    });
    add('speed', `${t('menu.textSpeed')}: ${t('menu.speed' + cap(s.speed))}`, () => {
      store.saveSettings({ speed: SPEEDS[(SPEEDS.indexOf(s.speed) + 1) % SPEEDS.length] });
      render();
    });
    if (game) add('share', t('menu.copyLink'), share);
    add('invite', t('menu.invite'), () => {}, true);
    add('about', t('menu.about'), () => { about = !about; render(); });
    if (about) para('about', t('menu.aboutText'));
    if (msg) para('msg', msg);
    el.querySelector('button').focus();
  }

  function open() {
    about = false; msg = '';
    render();
    el.hidden = false;
    app.inert = true;
    document.body.dataset.menu = '1';
  }
  function close() {
    if (el.hidden) return;
    el.hidden = true;
    app.inert = false;
    delete document.body.dataset.menu;
    document.getElementById('menu-btn').focus();
  }

  return { open, close, toggle: () => (el.hidden ? open() : close()), isOpen: () => !el.hidden };
}
