import { test } from 'node:test';
import assert from 'node:assert/strict';
import { typewrite } from '../../js/ui/typewriter.js';

function fake() {
  const q = [];
  return {
    q,
    setTimer: (fn, ms) => { const t = { fn, ms }; q.push(t); return t; },
    clearTimer: (t) => { const k = q.indexOf(t); if (k >= 0) q.splice(k, 1); },
    tick() { const t = q.shift(); t.fn(); return t.ms; },
  };
}

test('teclea en orden con pausas extra tras . ? ! y salto de línea', () => {
  const f = fake(), got = [];
  let done = 0;
  typewrite('a.\nb', { charDelay: 10, setTimer: f.setTimer, clearTimer: f.clearTimer,
    onChar: (c, i, instant) => got.push([c, i, instant]), onDone: () => done++ });
  const delays = [];
  while (f.q.length) delays.push(f.tick());
  assert.deepEqual(got.map((g) => g[0]).join(''), 'a.\nb');
  assert.deepEqual(got.map((g) => g[1]), [0, 1, 2, 3]);
  assert.ok(got.every((g) => g[2] === false));
  assert.deepEqual(delays, [0, 10, 70, 90]); // tras '.', '\n' hay pausa extra
  assert.equal(done, 1);
});

test('skip entrega el resto de golpe con onSkip y llama onDone una vez', async () => {
  const f = fake(), chars = [], skips = [];
  let done = 0;
  const w = typewrite('hola', { setTimer: f.setTimer, clearTimer: f.clearTimer,
    onChar: (c) => chars.push(c), onSkip: (r, from) => skips.push([r, from]), onDone: () => done++ });
  f.tick(); f.tick();
  w.skip(); w.skip();
  assert.deepEqual(chars, ['h', 'o']);
  assert.deepEqual(skips, [['la', 2]]);
  assert.equal(f.q.length, 0);
  assert.equal(done, 1);
  await w.done;
});

test('skip sin onSkip usa onChar con instant=true', () => {
  const f = fake(), got = [];
  const w = typewrite('abc', { setTimer: f.setTimer, clearTimer: f.clearTimer, onChar: (c, i, s) => got.push([c, i, s]) });
  f.tick();
  w.skip();
  assert.deepEqual(got, [['a', 0, false], ['b', 1, true], ['c', 2, true]]);
});

test('cancel detiene sin onDone y resuelve la promesa', async () => {
  const f = fake(), got = [];
  let done = 0;
  const w = typewrite('abc', { setTimer: f.setTimer, clearTimer: f.clearTimer,
    onChar: (c) => got.push(c), onDone: () => done++ });
  f.tick();
  w.cancel();
  w.skip();
  assert.deepEqual(got, ['a']);
  assert.equal(f.q.length, 0);
  assert.equal(done, 0);
  await w.done;
});

test('charDelay 0 es instantáneo', async () => {
  const got = [];
  let done = 0, skipped;
  const w = typewrite('hi', { charDelay: 0, onSkip: (r) => (skipped = r), onDone: () => done++ });
  assert.equal(skipped, 'hi');
  assert.equal(done, 1);
  await w.done;
  typewrite('x', { charDelay: 0, onChar: (c, i, s) => got.push([c, i, s]) });
  assert.deepEqual(got, [['x', 0, true]]);
});

test('texto vacío termina sin llamar onChar', async () => {
  let done = 0, n = 0;
  const w = typewrite('', { onChar: () => n++, onDone: () => done++ });
  await w.done;
  assert.equal(n, 0);
  assert.equal(done, 1);
});
