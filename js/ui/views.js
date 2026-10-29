// Vistas: selector de historias (#/) y partida (#/play/...), incluido el final.
import { createState, reduce, availableOptions, nodeText } from '../engine/engine.js';
import { LocalTransport } from '../net/transport.js';
import { encodeLog, decodeLog } from '../session/session.js';
import { hashFor } from '../router.js';
import { t } from '../i18n/es.js';

const stars = (d) => '★'.repeat(d) + '☆'.repeat(Math.max(0, 3 - d));
const countEndings = (story) => Object.values(story.nodes).filter((n) => n.ending).length;
const goHome = () => { location.hash = '#/'; };

export function showHome({ terminal, store, storage, stories, loadStory, isUnlocked }) {
  let alive = true;
  document.body.dataset.view = 'home';
  document.getElementById('title').textContent = t('title');
  terminal.clear();
  if (!storage.isPersistent) terminal.notice(t('notice.memoryOnly'));

  async function list() {
    const totals = await Promise.all(stories.map((s) => loadStory(s.id).then(countEndings, () => 0)));
    if (!alive) return;
    const box = document.createElement('div');
    box.className = 'stories';
    stories.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.testid = 'story';
      b.dataset.storyId = s.id;
      b.innerHTML = '<span class="st-title"></span><span class="st-meta"></span><span class="st-tag"></span>';
      b.children[0].textContent = s.title;
      b.children[1].textContent = `${stars(s.difficulty)} · ${t('home.minutes', { n: s.estimatedMinutes })} · ${t('stories.endings', { n: store.listEndings(s.id).length, total: totals[i] })}`;
      b.children[2].textContent = s.tagline;
      b.onclick = () => { location.hash = hashFor({ name: 'new', storyId: s.id }); };
      box.appendChild(b);
    });
    const inProgress = store.listSessions()
      .map((e) => ({ ...e, session: store.loadSession(e.id), story: stories.find((s) => s.id === e.storyId) }))
      .filter((e) => e.story && e.session && e.session.status === 'playing');
    if (inProgress.length) {
      const h = document.createElement('p');
      h.className = 'hdr';
      h.textContent = t('home.continue');
      box.appendChild(h);
      inProgress.forEach((e) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.testid = 'continue';
        b.dataset.sessionId = e.id;
        b.textContent = `${e.story.title} · ${t('home.decisions', { n: e.session.log.length })}`;
        b.onclick = () => { location.hash = hashFor({ name: 'play', storyId: e.storyId, sessionId: e.id }); };
        box.appendChild(b);
      });
    }
    document.getElementById('log').appendChild(box);
  }

  (async () => {
    await terminal.type(t('title'), 'big');
    if (!alive) return;
    if (isUnlocked()) list();
    else terminal.buttons([{ label: t('start'), testid: 'start', onClick: list }]);
  })();

  return { stop() { alive = false; } };
}

// Reconstruye los estados paso a paso desde ids de opción. null si el log no encaja con la historia.
function replayIds(story, ids) {
  const steps = [{ state: createState(story), label: null }];
  for (const id of ids) {
    const prev = steps[steps.length - 1].state;
    const option = (story.nodes[prev.nodeId]?.options || []).find((o) => o.id === id);
    const { state, events } = reduce(story, prev, { type: 'CHOOSE', optionId: id });
    if (!option || events.some((e) => e.type === 'ERROR')) return null;
    steps.push({ state, label: option.label });
  }
  return steps;
}

const echoText = (label) => (label.startsWith('>') ? label : '> ' + label);

export function startGame({ terminal, store, storage, story, sessionId, hashLog }) {
  const saved = store.loadSession(sessionId);
  if (saved && saved.storyId !== story.id) { // enlace mezclado: la sesión manda sobre la historia de la URL
    location.replace(hashFor({ name: 'play', storyId: saved.storyId, sessionId }));
    return { stop() {} };
  }
  let alive = true;
  let state;
  const transport = new LocalTransport();
  transport.connect(sessionId);
  document.body.dataset.view = 'play';
  document.getElementById('title').textContent = story.title;
  terminal.clear();
  if (!storage.isPersistent) terminal.notice(t('notice.memoryOnly'));

  const restart = () => { location.hash = hashFor({ name: 'new', storyId: story.id }); };
  const endButtons = () => terminal.buttons([
    { label: t('ending.retry'), testid: 'retry', onClick: restart },
    { label: t('ending.otherStories'), testid: 'other-stories', onClick: goHome },
  ]);
  const save = () => {
    store.saveSession(sessionId, state);
    history.replaceState(null, '', hashFor({ name: 'play', storyId: story.id, sessionId, log: encodeLog(state.log.map((e) => e.optionId)) }));
  };

  async function enterNode(instant) {
    for (const p of nodeText(story, state)) {
      if (instant) terminal.print(p); else await terminal.type(p);
      if (!alive) return;
    }
    storage.set('typed:' + sessionId, state.log.length);
    if (state.status === 'ended') {
      store.addEnding(story.id, state.nodeId);
      document.body.dataset.view = 'ending';
      await terminal.ending(story.nodes[state.nodeId].ending, instant);
      if (alive) endButtons();
      return;
    }
    terminal.showOptions(availableOptions(story, state), (o) => {
      transport.send({ type: 'CHOOSE', optionId: o.id, playerId: 'local' });
    }, instant);
  }

  // Única vía de mutación del estado: acción recibida por el transporte.
  transport.onAction(async (action) => {
    const before = state;
    const { state: next, events } = reduce(story, state, action);
    const err = events.find((e) => e.type === 'ERROR');
    if (err) { console.warn('Acción rechazada:', err.code); return; }
    state = next;
    save();
    const label = story.nodes[before.nodeId].options.find((o) => o.id === action.optionId).label;
    await terminal.echo(echoText(label));
    if (!alive) return;
    await terminal.processing();
    if (alive) enterNode(false);
  });

  // Restauración: localStorage primero; si no hay, el ?l= del hash. Se intenta el replay aunque la
  // historia haya cambiado de versión (spec §6): solo si falla se avisa y se borra la sesión.
  const ids = saved ? saved.log.map((e) => e.optionId) : (hashLog ? decodeLog(hashLog) : []);
  const steps = ids && replayIds(story, ids);
  if (!steps) {
    store.removeSession(sessionId);
    terminal.notice(t('notice.storyChanged'));
    endButtons();
  } else {
    steps.slice(1).forEach(({ label }, i) => {
      nodeText(story, steps[i].state).forEach((p) => terminal.print(p));
      terminal.echo(echoText(label), true);
    });
    state = steps[steps.length - 1].state;
    if (saved ? saved.storyVersion !== story.version : ids.length) save(); // normaliza la versión guardada
    enterNode(storage.get('typed:' + sessionId) === state.log.length);
  }

  return {
    restart,
    stop() { alive = false; transport.close(); terminal.cancel(); },
  };
}
