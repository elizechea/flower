// Vista del modo IA: la historia es un prompt y un modelo local (WebLLM) narra y propone opciones.
// La sesión guarda la conversación entera en localStorage (no es reproducible como el log del motor).
import { buildMessages, parseReply, MODELS, START } from '../ai/prompt.js';
import { hasWebGPU, loadModel, complete } from '../ai/llm.js';
import { LocalTransport } from '../net/transport.js';
import { hashFor } from '../router.js';
import * as audio from '../audio/blip.js';
import { t } from '../i18n/es.js';

const goHome = () => { location.hash = '#/'; };
const echoText = (label) => (label.startsWith('>') ? label : '> ' + label);

export function startAiGame({ terminal, storage, story, sessionId }) {
  const key = 'ai:' + sessionId;
  const saved = storage.get(key);
  if (saved && saved.storyId !== story.id) {
    location.replace(hashFor({ name: 'ai', storyId: saved.storyId, sessionId }));
    return { stop() {} };
  }
  let alive = true;
  const s = saved && Array.isArray(saved.transcript)
    ? saved
    : { storyId: story.id, modelId: null, transcript: [], status: 'playing' };
  const transport = new LocalTransport();
  transport.connect(sessionId);
  document.body.dataset.view = 'play';
  document.getElementById('title').textContent = story.title;
  terminal.clear();
  if (!storage.isPersistent) terminal.notice(t('notice.memoryOnly'));

  const save = () => storage.set(key, s);
  const restart = () => { location.hash = hashFor({ name: 'ai-new', storyId: story.id }); };
  const endButtons = () => terminal.buttons([
    { label: t('ending.retry'), testid: 'retry', onClick: restart },
    { label: t('ending.otherStories'), testid: 'other-stories', onClick: goHome },
  ]);
  const failed = (msg, retry) => {
    terminal.notice(msg);
    terminal.buttons([
      { label: t('ending.retry'), testid: 'retry', onClick: retry },
      { label: t('ending.otherStories'), testid: 'other-stories', onClick: goHome },
    ]);
  };

  // Carga del modelo con una línea de progreso que se actualiza en sitio.
  async function engine() {
    const line = terminal.print(t('ai.loading', { pct: 0 }), 'processing');
    try {
      const e = await loadModel(s.modelId, (p) => { line.textContent = t('ai.loading', { pct: Math.round(p * 100) }); });
      line.remove();
      return e;
    } catch (err) {
      line.remove();
      throw err;
    }
  }

  async function generate() {
    let e;
    try { e = await engine(); } catch (err) {
      console.warn(err);
      if (alive) failed(t('ai.loadError'), generate);
      return;
    }
    if (!alive) return;
    const p = terminal.print(t('ui.processing'), 'processing');
    const dots = setInterval(() => { p.textContent = p.textContent.endsWith('...') ? t('ui.processing') : p.textContent + '.'; }, 300);
    let raw;
    try { raw = await complete(e, buildMessages(story, s.transcript)); } catch (err) {
      console.warn(err);
      clearInterval(dots); p.remove();
      if (alive) failed(t('ai.genError'), generate);
      return;
    } finally { clearInterval(dots); }
    p.remove();
    if (!alive) return;
    s.transcript.push({ role: 'assistant', content: raw });
    const reply = parseReply(raw);
    if (reply.ending) s.status = 'ended';
    save();
    for (const para of reply.paragraphs) {
      await terminal.type(para);
      if (!alive) return;
    }
    show(reply, false);
  }

  function show(reply, instant) {
    if (reply.ending) {
      document.body.dataset.view = 'ending';
      terminal.ending(reply.ending, instant).then(() => { if (alive) endButtons(); });
      return;
    }
    terminal.buttons(reply.options.map((label, i) => ({
      id: String.fromCharCode(97 + i), testid: 'option', label: `[${i + 1}] ${label}`,
      onClick: () => transport.send({ type: 'SAY', text: label, typed: false, playerId: 'local' }),
    })));
    terminal.input(t('ai.placeholder'), (text) => transport.send({ type: 'SAY', text, typed: true, playerId: 'local' }));
    if (!instant) audio.optionsAppear();
  }

  // Única vía de avance: acción recibida por el transporte (igual que el modo clásico).
  transport.onAction(async (action) => {
    if (action.type !== 'SAY' || s.status !== 'playing') return;
    s.transcript.push({ role: 'user', content: action.text });
    save();
    if (action.typed) terminal.echo(echoText(action.text), true); // ya lo tecleó el jugador
    else await terminal.echo(echoText(action.text));
    if (alive) generate();
  });

  function begin() {
    s.transcript.push({ role: 'user', content: START }); // el primer turno lo pide el propio juego
    save();
    generate();
  }

  function chooseModel() {
    story.intro.forEach((p) => terminal.print(p));
    terminal.notice(t('ai.download'));
    terminal.buttons([
      ...MODELS.map((m, i) => ({
        id: String.fromCharCode(97 + i), testid: 'model', label: `[${i + 1}] ${t('ai.model.' + m.key, { size: m.size })}`,
        onClick: () => { s.modelId = m.id; save(); begin(); },
      })),
      { label: t('ending.otherStories'), testid: 'other-stories', onClick: goHome },
    ]);
  }

  (async () => {
    // Restauración: se pinta toda la conversación al instante y sin sonido.
    let last = null;
    for (const m of s.transcript) {
      if (m.role === 'user') { if (m.content !== START) terminal.echo(echoText(m.content), true); continue; }
      last = parseReply(m.content);
      last.paragraphs.forEach((p) => terminal.print(p));
    }
    if (!(await hasWebGPU())) { if (alive) failed(t('ai.noWebGPU'), restart); return; }
    if (!alive) return;
    if (!s.modelId) return chooseModel();
    if (!s.transcript.length) return begin();
    if (s.transcript.at(-1).role === 'user') return generate(); // se cortó mientras pensaba
    show(last, true);
  })();

  return {
    restart,
    stop() { alive = false; transport.close(); terminal.cancel(); },
  };
}
