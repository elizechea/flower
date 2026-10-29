import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, hashFor } from '../../js/router.js';

test('parseHash: selector de historias', () => {
  assert.deepEqual(parseHash('#/'), { name: 'home' });
  assert.deepEqual(parseHash(''), { name: 'home' });
  assert.deepEqual(parseHash('#'), { name: 'home' });
  assert.deepEqual(parseHash(), { name: 'home' });
});

test('parseHash: partida', () => {
  assert.deepEqual(parseHash('#/play/colonia-kepler-9/abc12345'), {
    name: 'play', storyId: 'colonia-kepler-9', sessionId: 'abc12345',
  });
  assert.deepEqual(parseHash('#/play/x/abc123de9f'), { name: 'play', storyId: 'x', sessionId: 'abc123de9f' });
});

test('parseHash: partida con log en ?l=', () => {
  assert.deepEqual(parseHash('#/play/x/abc12345?l=a.b.c'), {
    name: 'play', storyId: 'x', sessionId: 'abc12345', log: 'a.b.c',
  });
  assert.equal(parseHash('#/play/x/abc12345?l=a%2Bb').log, 'a+b');
  assert.deepEqual(parseHash('#/play/x/abc12345?l='), { name: 'play', storyId: 'x', sessionId: 'abc12345' });
});

test('parseHash: nueva partida', () => {
  assert.deepEqual(parseHash('#/new/nave-a-la-deriva'), { name: 'new', storyId: 'nave-a-la-deriva' });
});

test('parseHash: rutas desconocidas o ids inválidos -> selector', () => {
  for (const h of [
    '#/foo', '#/play', '#/play/x', '#/play/x/abc12345/extra', '#/play/X/abc12345',
    '#/play/x/short', '#/play/x/abc123456789', '#/play/x/ABC12345', '#/play/x/abc_1234',
    '#/new', '#/new/', '#/new/x/y', '#/new/Bad Id',
  ]) {
    assert.deepEqual(parseHash(h), { name: 'home' }, h);
  }
});

test('hashFor: construye hashes', () => {
  assert.equal(hashFor({ name: 'home' }), '#/');
  assert.equal(hashFor({ name: 'new', storyId: 'x' }), '#/new/x');
  assert.equal(hashFor({ name: 'play', storyId: 'x', sessionId: 'abc12345' }), '#/play/x/abc12345');
  assert.equal(hashFor({ name: 'play', storyId: 'x', sessionId: 'abc12345', log: 'a.b.c' }), '#/play/x/abc12345?l=a.b.c');
});

test('hashFor y parseHash son ida y vuelta (log con caracteres especiales)', () => {
  const route = { name: 'play', storyId: 'x', sessionId: 'abc12345', log: 'a+b/c=d.e' };
  assert.deepEqual(parseHash(hashFor(route)), route);
});

test('modo IA: nueva partida y partida', () => {
  assert.deepEqual(parseHash('#/ai/carguero-argo'), { name: 'ai-new', storyId: 'carguero-argo' });
  assert.deepEqual(parseHash('#/ai/carguero-argo/abc12345'), { name: 'ai', storyId: 'carguero-argo', sessionId: 'abc12345' });
  assert.deepEqual(parseHash('#/ai/carguero-argo/MAL'), { name: 'home' });
  assert.equal(hashFor({ name: 'ai-new', storyId: 'x' }), '#/ai/x');
  assert.equal(hashFor({ name: 'ai', storyId: 'x', sessionId: 'abc12345' }), '#/ai/x/abc12345');
});
