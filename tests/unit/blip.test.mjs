import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

class FakeCtx {
  constructor() { this.currentTime = 0; this.state = 'suspended'; this.oscs = []; this.destination = {}; FakeCtx.last = this; }
  resume() { this.state = 'running'; }
  createGain() {
    return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() { this.off = true; } };
  }
  createOscillator() {
    const o = { type: '', freqs: [], frequency: { setValueAtTime: (f) => o.freqs.push(f), exponentialRampToValueAtTime() {} },
      connect() {}, disconnect() { o.off = true; }, start() {}, stop() {} };
    this.oscs.push(o);
    return o;
  }
}

let mod = 0;
async function fresh(AC = FakeCtx, gesture = true) {
  globalThis.AudioContext = AC;
  delete globalThis.webkitAudioContext;
  const a = await import(`../../js/audio/blip.js?${mod++}`);
  if (gesture) a.unlock();
  return a;
}
beforeEach(() => { delete globalThis.AudioContext; delete globalThis.navigator?.vibrate; });

test('sin gesto: no se crea el contexto ni suena nada', async () => {
  FakeCtx.last = null;
  const a = await fresh(FakeCtx, false);
  a.blip('a'); a.optionsAppear(); a.click(); a.badEnding();
  assert.equal(FakeCtx.last, null);
  a.unlock();
  assert.equal(FakeCtx.last.state, 'running');
  a.unlock(); // idempotente: no crea otro
  a.blip('a');
  assert.equal(FakeCtx.last.oscs.length, 1);
});

test('blip: ignora espacios y saltos, rango de frecuencia y duración', async () => {
  const a = await fresh();
  a.blip(' '); a.blip('\n');
  assert.equal(FakeCtx.last?.oscs.length ?? 0, 0);
  for (let i = 0; i < 50; i++) { a.blip('a'); FakeCtx.last.currentTime += 0.05; FakeCtx.last.oscs.at(-1).onended(); }
  for (const o of FakeCtx.last.oscs) {
    assert.equal(o.type, 'square');
    assert.ok(o.freqs[0] >= 900 * 0.92 - 1 && o.freqs[0] <= 1300 * 1.08 + 1);
  }
});

test('blip: throttle y tope de polifonía; desconecta en ended', async () => {
  const a = await fresh();
  a.blip('a'); a.blip('b'); // mismo instante: el segundo se descarta
  assert.equal(FakeCtx.last.oscs.length, 1);
  for (let i = 0; i < 20; i++) { FakeCtx.last.currentTime += 0.05; a.blip('c'); }
  assert.equal(FakeCtx.last.oscs.length, 6);
  FakeCtx.last.oscs[0].onended();
  assert.ok(FakeCtx.last.oscs[0].off);
  FakeCtx.last.currentTime += 0.05; a.blip('d');
  assert.equal(FakeCtx.last.oscs.length, 7);
});

test('mute: no suena y es consultable', async () => {
  const a = await fresh();
  a.setMuted(true);
  a.blip('a'); a.optionsAppear(); a.badEnding();
  assert.equal(a.isMuted(), true);
  assert.equal(FakeCtx.last?.oscs.length ?? 0, 0);
  a.setMuted(false);
  a.blip('a');
  assert.equal(FakeCtx.last.oscs.length, 1);
});

test('efectos: doble blip, arpegio, final malo, click con vibrate', async () => {
  const a = await fresh();
  a.optionsAppear(); assert.equal(FakeCtx.last.oscs.length, 2);
  a.goodEnding(); assert.equal(FakeCtx.last.oscs.length, 6);
  a.badEnding(); assert.equal(FakeCtx.last.oscs.length, 7);
  let v = 0;
  Object.defineProperty(globalThis, 'navigator', { value: { vibrate: () => v++ }, configurable: true });
  a.click();
  assert.equal(v, 1);
  assert.ok(FakeCtx.last.oscs.at(-1).freqs[0] < 1000);
});

test('keypress: tecla del jugador grave + chasquido, ignora espacios', async () => {
  const a = await fresh();
  a.keypress(' ');
  assert.equal(FakeCtx.last.oscs.length, 0);
  a.keypress('a');
  assert.equal(FakeCtx.last.oscs.length, 2);
  assert.ok(FakeCtx.last.oscs[0].freqs[0] < 300);
  a.setMuted(true); FakeCtx.last.currentTime += 0.05; a.keypress('b');
  assert.equal(FakeCtx.last.oscs.length, 2);
});

test('webkitAudioContext como alternativa', async () => {
  globalThis.webkitAudioContext = FakeCtx;
  delete globalThis.AudioContext;
  const a = await import(`../../js/audio/blip.js?${mod++}`);
  a.unlock(); a.blip('x');
  assert.equal(FakeCtx.last.oscs.length, 1);
  delete globalThis.webkitAudioContext;
});

test('sin AudioContext o con constructor que lanza: no lanza', async () => {
  let a = await fresh(undefined);
  delete globalThis.AudioContext;
  a = await import(`../../js/audio/blip.js?${mod++}`);
  for (const f of [a.unlock, () => a.blip('a'), a.click, a.optionsAppear, a.goodEnding, a.badEnding]) f();
  a = await fresh(class { constructor() { throw new Error('x'); } });
  a.unlock(); a.blip('a');
});
