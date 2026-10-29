import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMessages, parseReply, systemPrompt, START } from '../../js/ai/prompt.js';

const catalog = JSON.parse(readFileSync(new URL('../../stories/ai/index.json', import.meta.url)));
const story = catalog.stories[0];

test('catálogo IA: campos obligatorios e ids únicos', () => {
  assert.equal(catalog.schemaVersion, 1);
  const ids = catalog.stories.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of catalog.stories) {
    assert.match(s.id, /^[a-z0-9-]+$/);
    for (const k of ['title', 'tagline', 'prompt']) assert.ok(typeof s[k] === 'string' && s[k].length, `${s.id}.${k}`);
    assert.ok(Array.isArray(s.intro) && s.intro.length, `${s.id}.intro`);
  }
});

test('systemPrompt incluye el escenario y pide JSON', () => {
  const p = systemPrompt(story);
  assert.ok(p.includes(story.prompt));
  assert.ok(p.includes('JSON'));
});

test('buildMessages: sistema + apertura + últimos turnos', () => {
  const tr = [{ role: 'user', content: START }, { role: 'assistant', content: 'abre' }];
  for (let i = 0; i < 20; i++) tr.push({ role: i % 2 ? 'assistant' : 'user', content: 'm' + i });
  const m = buildMessages(story, tr);
  assert.equal(m[0].role, 'system');
  assert.deepEqual(m.slice(1, 3), tr.slice(0, 2));
  assert.deepEqual(m.slice(3), tr.slice(-10));
  assert.equal(buildMessages(story, tr.slice(0, 3)).length, 4); // corto: sin duplicados
});

test('parseReply: respuesta válida', () => {
  const r = parseReply(JSON.stringify({ texto: ['Hola.', ' '], opciones: ['a', 'a', 'b', 'c', 'd', 'e'], final: { tipo: 'ninguno', titulo: '' } }));
  assert.deepEqual(r, { paragraphs: ['Hola.'], options: ['a', 'b', 'c', 'd'], ending: null });
});

test('parseReply: final, etiquetas largas y texto suelto', () => {
  const end = parseReply(JSON.stringify({ texto: 'Fin.', opciones: ['x'], final: { tipo: 'malo', titulo: 'vacío' } }));
  assert.deepEqual(end, { paragraphs: ['Fin.'], options: [], ending: { type: 'bad', title: 'VACÍO' } });
  const long = parseReply(JSON.stringify({ texto: [], opciones: ['x'.repeat(80)], final: { tipo: 'ninguno', titulo: '' } }));
  assert.equal(long.options[0].length, 48);
  assert.deepEqual(long.paragraphs, ['...']);
});

test('parseReply: no JSON u opciones vacías -> continuar, nunca lanza', () => {
  assert.deepEqual(parseReply('texto libre'), { paragraphs: ['texto libre'], options: ['Continuar'], ending: null });
  assert.deepEqual(parseReply(''), { paragraphs: ['...'], options: ['Continuar'], ending: null });
  assert.deepEqual(parseReply('null').options, ['Continuar']);
  assert.deepEqual(parseReply('{"texto":["a"],"opciones":[]}').options, ['Continuar']);
});
