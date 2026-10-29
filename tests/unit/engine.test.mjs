import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createState, availableOptions, reduce, replay, interpolate, nodeText } from '../../js/engine/engine.js';

const story = JSON.parse(readFileSync(new URL('../fixtures/mini-story.json', import.meta.url), 'utf8'));
const choose = (optionId, playerId) => ({ type: 'CHOOSE', optionId, playerId });
const errorCode = (events) => events.find((e) => e.type === 'ERROR')?.code;

// Ruta buena completa: inicio → pasillo → puente → casa
const GOOD_PATH = ['buscar', 'puerta', 'rumbo'];
function play(ids, state = createState(story)) {
  let last;
  for (const id of ids) { last = reduce(story, state, choose(id)); state = last.state; }
  return { state, events: last.events };
}

test('createState: campos iniciales, copia de vars y congelado', () => {
  const s = createState(story);
  assert.deepEqual(s, { storyId: 'mini', storyVersion: 1, nodeId: 'inicio', vars: { energia: 2, llave: false }, log: [], status: 'playing' });
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.vars) && Object.isFrozen(s.log));
  assert.notEqual(s.vars, story.vars);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('availableOptions: oculta las no cumplidas, marca locked las showLocked', () => {
  const opts = availableOptions(story, createState(story));
  assert.deepEqual(opts.map((o) => [o.id, o.locked === true]), [['buscar', false], ['puerta', true]]);
  assert.notEqual(opts[0], story.nodes.inicio.options[0]);
  const afterKey = play(['buscar', 'volver']).state;
  assert.deepEqual(availableOptions(story, afterKey).map((o) => o.id), ['puerta']);
});

test('reduce: opción válida cambia nodo, aplica efectos y registra en el log', () => {
  const s0 = createState(story);
  const { state, events } = reduce(story, s0, choose('buscar', 'p1'));
  assert.equal(state.nodeId, 'pasillo');
  assert.deepEqual(state.vars, { energia: 1, llave: true });
  assert.deepEqual(state.log, [{ nodeId: 'inicio', optionId: 'buscar', playerId: 'p1' }]);
  assert.deepEqual(events, [{ type: 'ENTER_NODE', nodeId: 'pasillo' }]);
  assert.equal(state.status, 'playing');
  assert.equal(reduce(story, s0, choose('buscar')).state.log[0].playerId, null);
});

test('reduce: efectos set/inc/dec', () => {
  const tiny = {
    id: 't', version: 1, start: 'a', vars: { n: 1 },
    nodes: {
      a: { text: 'a', options: [{ id: 'x', label: 'x', to: 'b', effects: [{ inc: 'n', by: 3 }, { dec: 'n' }, { set: 'ok', value: true }] }] },
      b: { text: 'b', ending: { type: 'good', title: 'B' } },
    },
  };
  assert.deepEqual(reduce(tiny, createState(tiny), choose('x')).state.vars, { n: 3, ok: true });
});

test('reduce: acciones inválidas devuelven el mismo estado y evento ERROR', () => {
  const s0 = createState(story);
  const cases = [
    [choose('nope'), 'OPTION_NOT_FOUND'],
    [choose('puerta'), 'OPTION_LOCKED'],
    [choose('saltar'), 'OPTION_LOCKED'],
    [{ type: 'JUMP', optionId: 'buscar' }, 'INVALID_ACTION'],
    [undefined, 'INVALID_ACTION'],
  ];
  for (const [action, code] of cases) {
    const r = reduce(story, s0, action);
    assert.equal(r.state, s0, code);
    assert.equal(errorCode(r.events), code);
    assert.equal(typeof r.events[0].message, 'string');
  }
  const broken = { ...story, nodes: { ...story.nodes, pasillo: { text: 'x', options: [{ id: 'q', label: 'q', to: 'limbo' }] } } };
  const s1 = reduce(broken, createState(broken), choose('buscar')).state;
  assert.equal(errorCode(reduce(broken, s1, choose('q')).events), 'TARGET_NOT_FOUND');
  assert.equal(errorCode(reduce(broken, { ...s1, nodeId: 'nada' }, choose('q')).events), 'NODE_NOT_FOUND');
});

test('reduce: llegar a un final → status ended, evento ENDING, y luego GAME_ENDED', () => {
  const { state, events } = play(GOOD_PATH);
  assert.equal(state.status, 'ended');
  assert.equal(state.nodeId, 'casa');
  assert.deepEqual(events, [
    { type: 'ENTER_NODE', nodeId: 'casa' },
    { type: 'ENDING', ending: { nodeId: 'casa', type: 'good', title: 'A CASA' } },
  ]);
  const r = reduce(story, state, choose('rumbo'));
  assert.equal(r.state, state);
  assert.equal(errorCode(r.events), 'GAME_ENDED');
});

test('reduce: el estado anterior es inmutable', () => {
  const s0 = createState(story);
  const snapshot = JSON.parse(JSON.stringify(s0));
  const { state } = reduce(story, s0, choose('buscar'));
  assert.deepEqual(s0, snapshot);
  assert.ok(Object.isFrozen(state) && Object.isFrozen(state.vars) && Object.isFrozen(state.log) && Object.isFrozen(state.log[0]));
  assert.throws(() => { state.vars.energia = 99; }, TypeError);
  assert.throws(() => { state.log.push({}); }, TypeError);
  assert.equal(state.vars.energia, 1);
});

test('replay: determinista y reconstruye el mismo estado desde el log', () => {
  const { state } = play(GOOD_PATH);
  const a = replay(story, state.log);
  const b = replay(story, JSON.parse(JSON.stringify(state.log)));
  assert.equal(a.error, undefined);
  assert.deepEqual(a.state, state);
  assert.deepEqual(a.state, b.state);
  assert.deepEqual(replay(story, []).state, createState(story));
});

test('replay: log inválido → error controlado con índice y último estado válido', () => {
  const { state } = play(['buscar']);
  const bad = replay(story, [...state.log, { nodeId: 'pasillo', optionId: 'inventada' }]);
  assert.deepEqual(bad.state, state);
  assert.equal(bad.error.code, 'OPTION_NOT_FOUND');
  assert.equal(bad.error.index, 1);
  assert.equal(typeof bad.error.message, 'string');

  const mismatch = replay(story, [{ nodeId: 'puente', optionId: 'rumbo' }]);
  assert.equal(mismatch.error.code, 'LOG_NODE_MISMATCH');
  assert.equal(mismatch.error.index, 0);
  assert.deepEqual(mismatch.state, createState(story));

  assert.equal(replay(story, 'no').error.code, 'INVALID_LOG');
  assert.equal(replay(story, [null]).error.code, 'INVALID_LOG');
  assert.equal(replay(story, [{ nodeId: 'inicio' }]).error.code, 'INVALID_LOG');
});

test('interpolate y nodeText: {var} se sustituye, marcador desconocido se conserva', () => {
  assert.equal(interpolate('E: {energia}/{max} {llave}', { energia: 2, llave: false }), 'E: 2/{max} false');
  const s0 = createState(story);
  assert.deepEqual(nodeText(story, s0), ['Energía: 2.', 'Hola, {nombre}.']);
  assert.deepEqual(nodeText(story, s0, 'pasillo'), ['Un pasillo.']);
  assert.deepEqual(nodeText(story, s0, 'nada'), []);
  assert.deepEqual(nodeText(story, play(['buscar']).state, 'inicio'), ['Energía: 1.', 'Hola, {nombre}.']);
});
