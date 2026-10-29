// Validador de historias y del catálogo. Puro: lo usan los tests y tools/validate-stories.mjs.

import { checkRequires, applyEffects, CONDITION_OPS, EFFECT_OPS } from './conditions.js';

const ID_RE = /^[a-z0-9-]+$/;
const ENDING_TYPES = ['good', 'bad', 'neutral'];
const MAX_OPTIONS = 4;
const MAX_LABEL = 48;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' || (Array.isArray(v) && v.every((p) => typeof p === 'string'));

/**
 * Explora el espacio de estados (nodo, vars) desde `start` con BFS, respetando `requires`/`effects`,
 * y hace alcanzabilidad inversa desde los finales para detectar trampas (estados alcanzables desde los
 * que no se llega a ningún final). Tolera destinos inexistentes (los ignora).
 * Si se supera `maxStates`, `truncated = true` y los estados no expandidos se consideran "con salida"
 * (no se reportan trampas falsas).
 * @returns {{ reachableNodes: string[], unreachableNodes: string[], endings: Array<{nodeId,type,title,reachable}>,
 *            trapNodes: string[], truncated: boolean, statesExplored: number }}
 */
export function analyzeStory(story, { maxStates = 200000 } = {}) {
  const nodes = story.nodes || {};
  const key = (nodeId, vars) => nodeId + '\u0000' + JSON.stringify(Object.keys(vars).sort().map((k) => [k, vars[k]]));
  const states = []; // { nodeId, vars, next: number[] }
  const index = new Map(); // key -> state id
  const intern = (nodeId, vars) => {
    const k = key(nodeId, vars);
    if (!index.has(k)) {
      index.set(k, states.length);
      states.push({ nodeId, vars, next: [] });
    }
    return index.get(k);
  };

  let truncated = false;
  let expanded = 0;
  if (nodes[story.start]) intern(story.start, { ...(story.vars || {}) });
  for (let i = 0; i < states.length; i++) {
    if (i >= maxStates) { truncated = true; break; }
    const s = states[i];
    const node = nodes[s.nodeId];
    expanded++;
    if (node.ending) continue;
    for (const opt of node.options || []) {
      if (!isObj(opt) || !nodes[opt.to] || !checkRequires(opt.requires, s.vars)) continue;
      s.next.push(intern(opt.to, applyEffects(opt.effects, s.vars)));
    }
  }

  // Alcanzabilidad inversa: desde finales (y estados sin expandir, si truncó) hacia atrás.
  const prev = states.map(() => []);
  states.forEach((s, i) => s.next.forEach((j) => prev[j].push(i)));
  const hasExit = new Array(states.length).fill(false);
  const stack = [];
  states.forEach((s, i) => {
    if (nodes[s.nodeId].ending || i >= expanded) { hasExit[i] = true; stack.push(i); }
  });
  while (stack.length) {
    for (const p of prev[stack.pop()]) if (!hasExit[p]) { hasExit[p] = true; stack.push(p); }
  }

  const reachable = new Set(states.map((s) => s.nodeId));
  const traps = new Set(states.filter((_, i) => !hasExit[i]).map((s) => s.nodeId));
  const allIds = Object.keys(nodes);
  return {
    reachableNodes: allIds.filter((id) => reachable.has(id)),
    unreachableNodes: allIds.filter((id) => !reachable.has(id)),
    endings: allIds.filter((id) => nodes[id].ending).map((id) => ({
      nodeId: id, type: nodes[id].ending.type, title: nodes[id].ending.title, reachable: reachable.has(id),
    })),
    trapNodes: allIds.filter((id) => traps.has(id)),
    truncated,
    statesExplored: states.length,
  };
}

/**
 * Valida una historia completa (esquema + grafo + alcanzabilidad).
 * @returns {{ ok: boolean, errors: Array<{code,message,nodeId?,optionId?}>, warnings: Array<{code,message,nodeId?,optionId?}> }}
 */
export function validateStory(story) {
  const errors = [];
  const warnings = [];
  const err = (code, message, where = {}) => errors.push({ code, message, ...where });
  const warn = (code, message, where = {}) => warnings.push({ code, message, ...where });

  if (!isObj(story)) {
    err('STORY_INVALID', 'La historia no es un objeto JSON.');
    return { ok: false, errors, warnings };
  }
  if (story.schemaVersion !== 1) err('SCHEMA_VERSION', `schemaVersion debe ser 1 (recibido: ${JSON.stringify(story.schemaVersion)}).`);
  if (typeof story.id !== 'string' || !ID_RE.test(story.id)) err('ID_INVALID', 'id debe ser una cadena con solo [a-z0-9-].');
  if (!Number.isInteger(story.version) || story.version < 1) err('VERSION_INVALID', 'version debe ser un entero >= 1.');
  if (typeof story.title !== 'string' || !story.title.trim()) err('TITLE_MISSING', 'title debe ser una cadena no vacía.');
  if (typeof story.start !== 'string') err('START_MISSING', 'start debe ser el id del nodo inicial.');
  if (!isObj(story.nodes) || Object.keys(story.nodes).length === 0) err('NODES_MISSING', 'nodes debe ser un objeto con al menos un nodo.');
  if (story.vars !== undefined && !isObj(story.vars)) err('VARS_INVALID', 'vars debe ser un objeto.');
  if (story.difficulty !== undefined && ![1, 2, 3].includes(story.difficulty)) warn('DIFFICULTY_INVALID', 'difficulty debería ser 1, 2 o 3.');
  if (errors.length) return { ok: false, errors, warnings };

  const nodes = story.nodes;
  if (!nodes[story.start]) err('START_NOT_FOUND', `El nodo inicial "${story.start}" no existe.`);

  const declaredVars = new Set(Object.keys(story.vars || {}));
  const setVars = new Set();
  const usedVars = []; // [name, where]

  for (const [nodeId, node] of Object.entries(nodes)) {
    const at = { nodeId };
    if (!isObj(node)) { err('NODE_INVALID', `El nodo "${nodeId}" no es un objeto.`, at); continue; }
    if (!isText(node.text)) err('TEXT_INVALID', `El nodo "${nodeId}" necesita text (cadena o lista de cadenas).`, at);
    const hasOptions = Array.isArray(node.options) && node.options.length > 0;
    if (node.ending) {
      if (!isObj(node.ending) || !ENDING_TYPES.includes(node.ending.type)) {
        err('ENDING_TYPE_INVALID', `El final "${nodeId}" necesita ending.type good|bad|neutral.`, at);
      } else if (typeof node.ending.title !== 'string' || !node.ending.title.trim()) {
        err('ENDING_TITLE_MISSING', `El final "${nodeId}" necesita ending.title.`, at);
      }
      if (hasOptions) err('ENDING_WITH_OPTIONS', `El nodo final "${nodeId}" no puede tener options.`, at);
      continue;
    }
    if (!hasOptions) { err('NODE_WITHOUT_OPTIONS', `El nodo "${nodeId}" no tiene options ni ending.`, at); continue; }
    if (node.options.length > MAX_OPTIONS) err('TOO_MANY_OPTIONS', `El nodo "${nodeId}" tiene ${node.options.length} opciones (máximo ${MAX_OPTIONS}).`, at);

    const seen = new Set();
    for (const opt of node.options) {
      if (!isObj(opt)) { err('OPTION_INVALID', `Una opción de "${nodeId}" no es un objeto.`, at); continue; }
      const where = { nodeId, optionId: opt.id };
      if (typeof opt.id !== 'string' || !opt.id) err('OPTION_ID_INVALID', `Una opción de "${nodeId}" no tiene id.`, at);
      else if (seen.has(opt.id)) err('OPTION_ID_DUPLICATE', `Id de opción "${opt.id}" repetido en "${nodeId}".`, where);
      seen.add(opt.id);
      if (typeof opt.label !== 'string' || !opt.label.trim()) err('LABEL_MISSING', `La opción "${opt.id}" de "${nodeId}" no tiene label.`, where);
      else if (opt.label.length > MAX_LABEL) err('LABEL_TOO_LONG', `La etiqueta de "${opt.id}" en "${nodeId}" tiene ${opt.label.length} caracteres (máximo ${MAX_LABEL}).`, where);
      if (typeof opt.to !== 'string' || !nodes[opt.to]) err('TARGET_NOT_FOUND', `La opción "${opt.id}" de "${nodeId}" apunta a un nodo inexistente "${opt.to}".`, where);

      if (opt.requires !== undefined) {
        if (!isObj(opt.requires)) err('REQUIRES_INVALID', `requires de "${opt.id}" en "${nodeId}" debe ser un objeto.`, where);
        else for (const [name, cond] of Object.entries(opt.requires)) {
          usedVars.push([name, where]);
          if (isObj(cond)) for (const op of Object.keys(cond)) {
            if (!CONDITION_OPS.includes(op)) err('CONDITION_OP_UNKNOWN', `Operador "${op}" desconocido en requires.${name} de "${opt.id}" en "${nodeId}" (válidos: ${CONDITION_OPS.join(', ')}).`, where);
          }
        }
      }
      if (opt.effects !== undefined) {
        if (!Array.isArray(opt.effects)) err('EFFECTS_INVALID', `effects de "${opt.id}" en "${nodeId}" debe ser una lista.`, where);
        else for (const e of opt.effects) {
          const ops = isObj(e) ? Object.keys(e).filter((k) => EFFECT_OPS.includes(k)) : [];
          if (ops.length !== 1) { err('EFFECT_OP_UNKNOWN', `Efecto ${JSON.stringify(e)} en "${opt.id}" de "${nodeId}": debe tener exactamente uno de ${EFFECT_OPS.join('/')}.`, where); continue; }
          if (typeof e[ops[0]] !== 'string') err('EFFECT_VAR_INVALID', `Efecto ${ops[0]} en "${opt.id}" de "${nodeId}" debe nombrar una variable.`, where);
          else setVars.add(e[ops[0]]);
          if (ops[0] === 'set' && !('value' in e)) err('EFFECT_VALUE_MISSING', `Efecto set de "${e.set}" en "${opt.id}" de "${nodeId}" necesita value.`, where);
          if (ops[0] !== 'set' && e.by !== undefined && typeof e.by !== 'number') err('EFFECT_BY_INVALID', `by del efecto ${ops[0]} en "${opt.id}" de "${nodeId}" debe ser un número.`, where);
        }
      }
    }
  }
  for (const [name, where] of usedVars) {
    if (!declaredVars.has(name) && !setVars.has(name)) warn('VAR_UNDECLARED', `La variable "${name}" se usa en requires pero no está en vars ni la fija ningún efecto.`, where);
  }

  // Con errores estructurales el análisis del grafo solo añadiría ruido.
  if (errors.length) return { ok: false, errors, warnings };
  const a = analyzeStory(story);
  if (a.endings.length === 0) err('NO_ENDING', 'La historia no tiene ningún nodo final.');
  else if (!a.endings.some((e) => e.type === 'good' && e.reachable)) warn('NO_GOOD_ENDING', 'La historia no tiene ningún final bueno alcanzable.');
  for (const id of a.unreachableNodes) err('UNREACHABLE_NODE', `El nodo "${id}" no es alcanzable desde "${story.start}".`, { nodeId: id });
  for (const e of a.endings) if (!e.reachable) err('UNREACHABLE_ENDING', `El final "${e.nodeId}" (${e.type}) no es alcanzable teniendo en cuenta requires/effects.`, { nodeId: e.nodeId });
  for (const id of a.trapNodes) err('TRAP_NODE', `Desde el nodo "${id}" no se puede llegar a ningún final (ciclo sin salida o requires imposibles).`, { nodeId: id });
  if (a.truncated) warn('ANALYSIS_TRUNCATED', `Exploración truncada en ${a.statesExplored} estados; la detección de trampas puede ser incompleta.`);

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Comprueba que `stories/index.json` coincide con las historias reales.
 * @param {object} index  contenido de index.json
 * @param {Array<object>} stories  historias cargadas de stories/*.json
 * @returns {{ ok: boolean, errors: Array<{code,message}>, warnings: Array<{code,message}> }}
 */
export function validateIndex(index, stories) {
  const errors = [];
  const err = (code, message) => errors.push({ code, message });
  if (!isObj(index) || index.schemaVersion !== 1 || !Array.isArray(index.stories)) {
    err('INDEX_INVALID', 'index.json debe tener schemaVersion 1 y una lista stories.');
    return { ok: false, errors, warnings: [] };
  }
  const byId = new Map(stories.map((s) => [s.id, s]));
  const seen = new Set();
  for (const entry of index.stories) {
    if (!isObj(entry) || typeof entry.id !== 'string') { err('INDEX_ENTRY_INVALID', `Entrada del índice sin id: ${JSON.stringify(entry)}.`); continue; }
    if (seen.has(entry.id)) err('INDEX_ID_DUPLICATE', `Id "${entry.id}" repetido en el índice.`);
    seen.add(entry.id);
    if (entry.file !== `${entry.id}.json`) err('INDEX_FILE_MISMATCH', `La entrada "${entry.id}" debe tener file "${entry.id}.json" (recibido: ${JSON.stringify(entry.file)}).`);
    const story = byId.get(entry.id);
    if (!story) { err('INDEX_STORY_NOT_FOUND', `El índice lista "${entry.id}" pero no existe esa historia.`); continue; }
    for (const field of ['title', 'tagline', 'difficulty', 'estimatedMinutes', 'version']) {
      if (entry[field] !== story[field]) err('INDEX_FIELD_MISMATCH', `"${entry.id}".${field}: el índice dice ${JSON.stringify(entry[field])} y la historia ${JSON.stringify(story[field])}.`);
    }
  }
  for (const id of byId.keys()) if (!seen.has(id)) err('INDEX_ENTRY_MISSING', `La historia "${id}" no está en el índice.`);
  return { ok: errors.length === 0, errors, warnings: [] };
}
