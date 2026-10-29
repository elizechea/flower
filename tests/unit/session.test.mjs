import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../../js/session/storage.js';
import { createSessionStore, newSessionId, encodeLog, decodeLog } from '../../js/session/session.js';

const fakeLS = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};
const throwing = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };

test('storage: persistent get/set/remove with prefix', () => {
  const ls = fakeLS();
  const s = createStorage(ls);
  assert.equal(s.isPersistent, true);
  s.set('a', { n: 1 });
  assert.deepEqual(s.get('a'), { n: 1 });
  assert.ok(ls.m.has('terminal:v1:a'));
  s.remove('a');
  assert.equal(s.get('a'), null);
});

test('storage: throwing or missing localStorage falls back to memory', () => {
  for (const b of [throwing, null]) {
    const s = createStorage(b);
    assert.equal(s.isPersistent, false);
    s.set('a', 5);
    assert.equal(s.get('a'), 5);
  }
});

test('storage: unknown schema version or corrupt JSON is absent', () => {
  const ls = fakeLS();
  ls.setItem('terminal:v1:a', JSON.stringify({ v: 99, d: 1 }));
  ls.setItem('terminal:v1:b', '{nope');
  const s = createStorage(ls);
  assert.equal(s.get('a'), null);
  assert.equal(s.get('b'), null);
});

test('storage: write failing later degrades to memory', () => {
  const ls = fakeLS();
  const s = createStorage(ls);
  ls.setItem = () => { throw new Error('quota'); };
  s.set('a', 1);
  assert.equal(s.isPersistent, false);
  assert.equal(s.get('a'), 1);
});

test('newSessionId: 8-10 base36', () => {
  for (let i = 0; i < 50; i++) assert.match(newSessionId(), /^[a-z0-9]{8,10}$/);
  assert.notEqual(newSessionId(), newSessionId());
});

test('sessions: save/load/index order/remove', () => {
  let t = 100;
  const st = createSessionStore(createStorage(fakeLS()), () => t++);
  st.saveSession('a', { storyId: 's', storyVersion: 1, log: ['x'], status: 'playing' });
  st.saveSession('b', { storyId: 's', storyVersion: 1, log: [], status: 'playing' });
  const a2 = st.saveSession('a', { storyId: 's', storyVersion: 1, log: ['x', 'y'], status: 'ended' });
  assert.equal(a2.createdAt, 100);
  assert.equal(a2.updatedAt, 102);
  assert.deepEqual(st.loadSession('a').log, ['x', 'y']);
  assert.deepEqual(st.listSessions().map((e) => e.id), ['a', 'b']);
  st.removeSession('a');
  assert.equal(st.loadSession('a'), null);
  assert.deepEqual(st.listSessions().map((e) => e.id), ['b']);
  assert.equal(st.loadSession('zzz'), null);
});

test('endings: unique', () => {
  const st = createSessionStore(createStorage(fakeLS()));
  assert.deepEqual(st.listEndings('s'), []);
  st.addEnding('s', 'e1'); st.addEnding('s', 'e1'); st.addEnding('s', 'e2');
  assert.deepEqual(st.listEndings('s'), ['e1', 'e2']);
});

test('settings: defaults, patch, invalid values', () => {
  const st = createSessionStore(createStorage(fakeLS()));
  assert.deepEqual(st.getSettings(), { sound: true, speed: 'normal' });
  assert.deepEqual(st.saveSettings({ speed: 'fast' }), { sound: true, speed: 'fast' });
  assert.equal(st.saveSettings({ speed: 'warp' }).speed, 'normal');
  assert.equal(st.saveSettings({ sound: false }).sound, false);
});

test('log codec: round trip short, long, unsafe, empty', () => {
  const cases = [[], ['a'], ['go_north', 'take-key', 'o3'], Array.from({ length: 80 }, (_, i) => 'opt' + i), ['ñandú', 'a b', 'x/y?z'], ['a.b'], ['']];
  for (const c of cases) assert.deepEqual(decodeLog(encodeLog(c)), c);
  assert.equal(encodeLog(['a', 'b']), 'a.b');
  assert.ok(encodeLog(['ñ']).startsWith('b64~'));
  assert.match(encodeLog(cases[3]), /^b64~[A-Za-z0-9_-]+$/);
  assert.equal(decodeLog('b64~!!!'), null);
  assert.equal(decodeLog('a b'), null);
});
