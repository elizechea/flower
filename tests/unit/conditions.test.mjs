import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRequires, applyEffects } from '../../js/engine/conditions.js';

const vars = { energia: 3, llave: true, nombre: 'ana' };

test('checkRequires: sin requires → true', () => {
  assert.equal(checkRequires(undefined, vars), true);
  assert.equal(checkRequires(null, {}), true);
});

test('checkRequires: igualdad estricta', () => {
  assert.equal(checkRequires({ llave: true }, vars), true);
  assert.equal(checkRequires({ llave: false }, vars), false);
  assert.equal(checkRequires({ energia: 3 }, vars), true);
  assert.equal(checkRequires({ energia: '3' }, vars), false);
  assert.equal(checkRequires({ nombre: 'ana' }, vars), true);
  assert.equal(checkRequires({ energia: 3, llave: true }, vars), true);
  assert.equal(checkRequires({ energia: 3, llave: false }, vars), false);
});

test('checkRequires: gte/lte/gt/lt/ne', () => {
  assert.equal(checkRequires({ energia: { gte: 3 } }, vars), true);
  assert.equal(checkRequires({ energia: { gte: 4 } }, vars), false);
  assert.equal(checkRequires({ energia: { lte: 3 } }, vars), true);
  assert.equal(checkRequires({ energia: { lte: 2 } }, vars), false);
  assert.equal(checkRequires({ energia: { gt: 2 } }, vars), true);
  assert.equal(checkRequires({ energia: { gt: 3 } }, vars), false);
  assert.equal(checkRequires({ energia: { lt: 4 } }, vars), true);
  assert.equal(checkRequires({ energia: { lt: 3 } }, vars), false);
  assert.equal(checkRequires({ energia: { ne: 2 } }, vars), true);
  assert.equal(checkRequires({ energia: { ne: 3 } }, vars), false);
  assert.equal(checkRequires({ energia: { gte: 1, lt: 3 } }, vars), false);
  assert.equal(checkRequires({ energia: { gte: 1, lte: 3 } }, vars), true);
});

test('checkRequires: variable inexistente falla salvo con ne; operador desconocido falla', () => {
  assert.equal(checkRequires({ nada: true }, vars), false);
  assert.equal(checkRequires({ nada: { gte: 0 } }, vars), false);
  assert.equal(checkRequires({ nada: { lt: 1 } }, vars), false);
  assert.equal(checkRequires({ nada: { ne: 1 } }, vars), true);
  assert.equal(checkRequires({ energia: { between: 1 } }, vars), false);
});

test('applyEffects: set/inc/dec, by por defecto 1, variable inexistente parte de 0', () => {
  const out = applyEffects([
    { set: 'llave', value: false },
    { inc: 'energia' },
    { inc: 'energia', by: 2 },
    { dec: 'energia', by: 4 },
    { dec: 'nueva' },
    { set: 'nombre', value: 'eva' },
  ], vars);
  assert.deepEqual(out, { energia: 2, llave: false, nombre: 'eva', nueva: -1 });
});

test('applyEffects: no muta la entrada y devuelve copia aunque no haya efectos', () => {
  const before = { ...vars };
  const out = applyEffects(undefined, vars);
  assert.deepEqual(vars, before);
  assert.notEqual(out, vars);
  assert.deepEqual(out, vars);
  applyEffects([{ set: 'energia', value: 0 }], vars);
  assert.equal(vars.energia, 3);
});
