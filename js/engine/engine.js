// Motor PURO y determinista: no toca DOM, red, audio ni localStorage.
// (story, state, action) -> { state, events }. Los estados son JSON y están congelados en profundidad.

import { checkRequires, applyEffects } from './conditions.js';

function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    Object.values(obj).forEach(deepFreeze);
  }
  return obj;
}

const error = (code, message) => ({ type: 'ERROR', code, message });

/**
 * Estado inicial de una partida.
 * @returns {{ storyId: string, storyVersion: number, nodeId: string, vars: object, log: Array, status: 'playing'|'ended' }}
 */
export function createState(story) {
  const start = story.nodes[story.start];
  return deepFreeze({
    storyId: story.id,
    storyVersion: story.version,
    nodeId: story.start,
    vars: { ...(story.vars || {}) },
    log: [],
    status: start && start.ending ? 'ended' : 'playing',
  });
}

/**
 * Opciones visibles del nodo actual. Las que no cumplen `requires` se ocultan, salvo que tengan
 * `showLocked: true`: entonces se devuelven con `locked: true`.
 * @returns {Array<object>} copias de las opciones (nunca las del story)
 */
export function availableOptions(story, state) {
  const node = story.nodes[state.nodeId];
  if (!node || !node.options) return [];
  return node.options.flatMap((opt) => {
    if (checkRequires(opt.requires, state.vars)) return [{ ...opt }];
    return opt.showLocked ? [{ ...opt, locked: true }] : [];
  });
}

/**
 * Reductor. action = { type: 'CHOOSE', optionId, playerId? }.
 * Nunca lanza: una acción inválida devuelve el MISMO estado y un evento
 * `{ type: 'ERROR', code, message }` con code ∈ INVALID_ACTION | GAME_ENDED | NODE_NOT_FOUND |
 * OPTION_NOT_FOUND | OPTION_LOCKED | TARGET_NOT_FOUND.
 * Acción válida: eventos `{ type: 'ENTER_NODE', nodeId }` y, si el destino es final,
 * `{ type: 'ENDING', ending: { nodeId, type, title } }`.
 * @returns {{ state: object, events: Array<object> }}
 */
export function reduce(story, state, action) {
  const fail = (code, message) => ({ state, events: [error(code, message)] });
  if (!action || action.type !== 'CHOOSE') return fail('INVALID_ACTION', 'Acción no reconocida.');
  if (state.status !== 'playing') return fail('GAME_ENDED', 'La partida ya ha terminado.');
  const node = story.nodes[state.nodeId];
  if (!node) return fail('NODE_NOT_FOUND', `El nodo "${state.nodeId}" no existe.`);
  const option = (node.options || []).find((o) => o.id === action.optionId);
  if (!option) return fail('OPTION_NOT_FOUND', `La opción "${action.optionId}" no existe en "${state.nodeId}".`);
  if (!checkRequires(option.requires, state.vars)) return fail('OPTION_LOCKED', `La opción "${option.id}" está bloqueada.`);
  const target = story.nodes[option.to];
  if (!target) return fail('TARGET_NOT_FOUND', `El destino "${option.to}" no existe.`);

  const next = deepFreeze({
    ...state,
    nodeId: option.to,
    vars: applyEffects(option.effects, state.vars),
    log: [...state.log, { nodeId: state.nodeId, optionId: option.id, playerId: action.playerId ?? null }],
    status: target.ending ? 'ended' : 'playing',
  });
  const events = [{ type: 'ENTER_NODE', nodeId: option.to }];
  if (target.ending) events.push({ type: 'ENDING', ending: { nodeId: option.to, ...target.ending } });
  return { state: next, events };
}

/**
 * Reconstruye el estado aplicando el log de elecciones desde el principio.
 * Devuelve `{ state }` si todo el log es válido. Si falla, `{ state, error }` donde `state` es el último
 * estado válido y `error = { code, message, index }` (index = posición del log que falló).
 * Códigos: INVALID_LOG (no es array / entrada malformada), LOG_NODE_MISMATCH (el nodeId de la entrada
 * no coincide con el estado) o cualquier código de ERROR de `reduce`.
 * @param {object} story
 * @param {Array<{ nodeId: string, optionId: string, playerId?: string|null }>} choiceLog
 * @returns {{ state: object, error?: { code: string, message: string, index: number } }}
 */
export function replay(story, choiceLog) {
  let state = createState(story);
  if (!Array.isArray(choiceLog)) return { state, error: { code: 'INVALID_LOG', message: 'El log no es una lista.', index: -1 } };
  for (let i = 0; i < choiceLog.length; i++) {
    const entry = choiceLog[i];
    if (!entry || typeof entry.optionId !== 'string') {
      return { state, error: { code: 'INVALID_LOG', message: `Entrada ${i} del log malformada.`, index: i } };
    }
    if (entry.nodeId !== state.nodeId) {
      return { state, error: { code: 'LOG_NODE_MISMATCH', message: `Entrada ${i}: se esperaba el nodo "${state.nodeId}" y el log dice "${entry.nodeId}".`, index: i } };
    }
    const result = reduce(story, state, { type: 'CHOOSE', optionId: entry.optionId, playerId: entry.playerId });
    const err = result.events.find((e) => e.type === 'ERROR');
    if (err) return { state, error: { code: err.code, message: `Entrada ${i}: ${err.message}`, index: i } };
    state = result.state;
  }
  return { state };
}

/** Sustituye `{var}` por su valor; los marcadores de variables inexistentes se dejan tal cual. */
export function interpolate(text, vars = {}) {
  return String(text).replace(/\{([A-Za-z_][\w]*)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

/** Párrafos del nodo (por defecto el actual) ya interpolados con `state.vars`. Nodo inexistente → []. */
export function nodeText(story, state, nodeId = state.nodeId) {
  const node = story.nodes[nodeId];
  if (!node) return [];
  const paragraphs = Array.isArray(node.text) ? node.text : [node.text];
  return paragraphs.map((p) => interpolate(p, state.vars));
}
