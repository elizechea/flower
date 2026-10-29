import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const sw = readFileSync(new URL('sw.js', root), 'utf8');
const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

test('SHELL: rutas relativas y existentes', () => {
  assert.ok(shell.length > 0);
  for (const p of shell) {
    assert.ok(!p.startsWith('/'), `ruta absoluta: ${p}`);
    assert.ok(existsSync(new URL(p, root)), `no existe: ${p}`);
  }
});

test('SHELL incluye todos los módulos js/', () => {
  const walk = (d) => readdirSync(new URL(d, root), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(`${d}${e.name}/`) : [`${d}${e.name}`]));
  for (const f of walk('js/')) assert.ok(shell.includes(f), `falta en SHELL: ${f}`);
});

test('manifest: iconos relativos y existentes', () => {
  const m = JSON.parse(readFileSync(new URL('manifest.webmanifest', root), 'utf8'));
  assert.equal(m.start_url, './');
  for (const i of m.icons) {
    assert.ok(!i.src.startsWith('/'));
    assert.ok(existsSync(new URL(i.src, root)), `no existe: ${i.src}`);
  }
});
