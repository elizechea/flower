import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateStory, analyzeStory, validateIndex } from '../../js/engine/validate.js';

const base = JSON.parse(readFileSync(new URL('../fixtures/mini-story.json', import.meta.url), 'utf8'));
const opt = (id, to, extra = {}) => ({ id, label: id, to, ...extra });
// Clona la historia válida, la rompe y devuelve los códigos de error.
function broken(mutate) {
  const story = structuredClone(base);
  mutate(story);
  return validateStory(story);
}
const codes = (r) => r.errors.map((e) => e.code);

test('validateStory: la historia de ejemplo es válida', () => {
  const r = validateStory(base);
  assert.deepEqual(r, { ok: true, errors: [], warnings: [] });
});

test('validateStory: esquema básico', () => {
  assert.deepEqual(codes(validateStory(null)), ['STORY_INVALID']);
  const r = validateStory({ schemaVersion: 2, id: 'Mal Id', version: 0, title: '', start: 1, nodes: {} });
  assert.deepEqual(codes(r), ['SCHEMA_VERSION', 'ID_INVALID', 'VERSION_INVALID', 'TITLE_MISSING', 'START_MISSING', 'NODES_MISSING']);
  assert.ok(r.errors.every((e) => typeof e.message === 'string' && e.message.length));
  assert.deepEqual(broken((s) => { s.difficulty = 7; }).warnings.map((w) => w.code), ['DIFFICULTY_INVALID']);
});

test('validateStory: start inexistente', () => {
  const r = broken((s) => { s.start = 'nada'; });
  assert.deepEqual(codes(r), ['START_NOT_FOUND']);
  assert.match(r.errors[0].message, /"nada"/);
});

test('validateStory: nodo destino inexistente', () => {
  const r = broken((s) => { s.nodes.pasillo.options[0].to = 'limbo'; });
  assert.deepEqual(r.errors.map((e) => [e.code, e.nodeId, e.optionId]), [['TARGET_NOT_FOUND', 'pasillo', 'volver']]);
  assert.match(r.errors[0].message, /"limbo"/);
});

test('validateStory: nodo inalcanzable', () => {
  const r = broken((s) => { s.nodes.isla = { text: 'x', options: [opt('a', 'casa')] }; });
  assert.deepEqual(r.errors.map((e) => [e.code, e.nodeId]), [['UNREACHABLE_NODE', 'isla']]);
});

test('validateStory: final inalcanzable por requires', () => {
  const r = broken((s) => { s.nodes.puente.options[0].requires = { energia: { gte: 10 } }; });
  assert.deepEqual(r.errors.map((e) => [e.code, e.nodeId]), [['UNREACHABLE_NODE', 'casa'], ['UNREACHABLE_ENDING', 'casa']]);
  assert.deepEqual(r.warnings.map((w) => w.code), ['NO_GOOD_ENDING']);
});

test('validateStory: nodo sin opciones y sin ending; final con opciones', () => {
  assert.deepEqual(codes(broken((s) => { delete s.nodes.puente.options; })), ['NODE_WITHOUT_OPTIONS']);
  assert.deepEqual(codes(broken((s) => { s.nodes.puente.options = []; })), ['NODE_WITHOUT_OPTIONS']);
  assert.deepEqual(codes(broken((s) => { s.nodes.casa.options = [opt('a', 'inicio')]; })), ['ENDING_WITH_OPTIONS']);
  assert.deepEqual(codes(broken((s) => { s.nodes.casa.ending = { type: 'meh', title: 'X' }; })), ['ENDING_TYPE_INVALID']);
  assert.deepEqual(codes(broken((s) => { delete s.nodes.casa.ending.title; })), ['ENDING_TITLE_MISSING']);
});

test('validateStory: id de opción duplicado, > 4 opciones, etiqueta larga', () => {
  assert.deepEqual(codes(broken((s) => { s.nodes.puente.options[1].id = 'rumbo'; })), ['OPTION_ID_DUPLICATE']);
  assert.deepEqual(codes(broken((s) => {
    s.nodes.puente.options.push(opt('c', 'casa'), opt('d', 'casa'), opt('e', 'casa'));
  })), ['TOO_MANY_OPTIONS']);
  const r = broken((s) => { s.nodes.puente.options[0].label = 'x'.repeat(49); });
  assert.deepEqual(codes(r), ['LABEL_TOO_LONG']);
  assert.match(r.errors[0].message, /49/);
  assert.equal(broken((s) => { s.nodes.puente.options[0].label = 'x'.repeat(48); }).ok, true);
  assert.deepEqual(codes(broken((s) => { s.nodes.puente.options[0].label = ''; })), ['LABEL_MISSING']);
});

test('validateStory: operadores desconocidos en effects y requires', () => {
  assert.deepEqual(codes(broken((s) => { s.nodes.inicio.options[0].effects.push({ mul: 'energia' }); })), ['EFFECT_OP_UNKNOWN']);
  assert.deepEqual(codes(broken((s) => { s.nodes.inicio.options[0].effects.push({ set: 'x' }); })), ['EFFECT_VALUE_MISSING']);
  assert.deepEqual(codes(broken((s) => { s.nodes.inicio.options[0].effects.push({ inc: 'energia', by: '1' }); })), ['EFFECT_BY_INVALID']);
  const r = broken((s) => { s.nodes.puente.options[0].requires = { energia: { between: 1 } }; });
  assert.ok(codes(r).includes('CONDITION_OP_UNKNOWN'));
  assert.match(r.errors[0].message, /"between"/);
  assert.deepEqual(broken((s) => { s.nodes.puente.options[0].requires = { fantasma: { ne: 1 } }; }).warnings.map((w) => w.code), ['VAR_UNDECLARED']);
});

test('validateStory: ciclo sin salida (trampa)', () => {
  const r = broken((s) => {
    s.nodes.bucle1 = { text: 'x', options: [opt('a', 'bucle2')] };
    s.nodes.bucle2 = { text: 'x', options: [opt('a', 'bucle1')] };
    s.nodes.puente.options.push(opt('bucle', 'bucle1'));
  });
  assert.deepEqual(r.errors.map((e) => [e.code, e.nodeId]), [['TRAP_NODE', 'bucle1'], ['TRAP_NODE', 'bucle2']]);
  // Trampa por estado: las vars impiden salir aunque el grafo tenga aristas de salida.
  const r2 = broken((s) => {
    s.nodes.puente.options[1].requires = { llave: false };
    s.nodes.puente.options[0].requires = { energia: { gte: 10 } };
  });
  assert.ok(codes(r2).includes('TRAP_NODE'));
});

test('analyzeStory: alcanzabilidad sobre (nodo, vars), finales y truncado', () => {
  const a = analyzeStory(base);
  assert.deepEqual(a.reachableNodes, ['inicio', 'pasillo', 'puente', 'casa', 'muerte']);
  assert.deepEqual(a.unreachableNodes, []);
  assert.deepEqual(a.endings, [
    { nodeId: 'casa', type: 'good', title: 'A CASA', reachable: true },
    { nodeId: 'muerte', type: 'bad', title: 'VACÍO', reachable: true },
  ]);
  assert.deepEqual(a.trapNodes, []);
  assert.equal(a.truncated, false);
  assert.ok(a.statesExplored >= 5);

  const t = analyzeStory(base, { maxStates: 1 });
  assert.equal(t.truncated, true);
  assert.deepEqual(t.trapNodes, []);
  assert.deepEqual(analyzeStory({ start: 'nada', nodes: base.nodes }).reachableNodes, []);
});

test('validateIndex: catálogo coherente con las historias', () => {
  const entry = { id: 'mini', file: 'mini.json', title: 'MINI', tagline: base.tagline, difficulty: 1, estimatedMinutes: 1, version: 1 };
  assert.equal(validateIndex({ schemaVersion: 1, stories: [entry] }, [base]).ok, true);
  const bad = validateIndex({ schemaVersion: 1, stories: [{ ...entry, file: 'otro.json', version: 2 }, { ...entry, id: 'nope' }] }, [base, { ...base, id: 'extra' }]);
  assert.deepEqual(bad.errors.map((e) => e.code), ['INDEX_FILE_MISMATCH', 'INDEX_FIELD_MISMATCH', 'INDEX_FILE_MISMATCH', 'INDEX_STORY_NOT_FOUND', 'INDEX_ENTRY_MISSING']);
  assert.deepEqual(validateIndex({ stories: [] }, []).errors.map((e) => e.code), ['INDEX_INVALID']);
});
