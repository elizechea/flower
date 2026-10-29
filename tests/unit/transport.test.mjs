import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalTransport } from '../../js/net/transport.js';

const choose = { type: 'CHOOSE', optionId: 'buscar', playerId: 'local' };

test('send entrega la acción a todos los onAction, en orden', () => {
  const t = new LocalTransport();
  t.connect('sesion-1');
  const a = [];
  const b = [];
  t.onAction((x) => a.push(x));
  t.onAction((x) => b.push(x));
  t.send(choose);
  assert.deepEqual(a, [choose]);
  assert.deepEqual(b, [choose]);
});

test('onPeers informa solo del jugador local', () => {
  const t = new LocalTransport();
  t.connect('sesion-1');
  let peers;
  t.onPeers((p) => { peers = p; });
  assert.deepEqual(peers, [{ id: 'local' }]);
});

test('send sin connect lanza error en vez de perder la acción', () => {
  assert.throws(() => new LocalTransport().send(choose), /connect/);
});

test('close corta la sesión y elimina los listeners', () => {
  const t = new LocalTransport();
  t.connect('sesion-1');
  let n = 0;
  t.onAction(() => { n++; });
  t.close();
  assert.throws(() => t.send(choose));
  t.connect('sesion-1');
  t.send(choose);
  assert.equal(n, 0);
});
