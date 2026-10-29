// Tests sobre TODAS las historias reales (spec §9.8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { validateStory, analyzeStory, validateIndex } from '../../js/engine/validate.js';

const dir = new URL('../../stories/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
const load = (f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
const stories = files.map(load);

test('hay historias', () => assert.ok(stories.length >= 1));

for (const [i, story] of stories.entries()) {
  test(`historia ${files[i]}`, () => {
    assert.equal(files[i], `${story.id}.json`, 'nombre de fichero = id');
    const r = validateStory(story);
    assert.deepEqual(r.errors, []);

    const nodes = Object.values(story.nodes);
    assert.ok(nodes.length >= 18 && nodes.length <= 30, `18-30 nodos (hay ${nodes.length})`);
    for (const n of nodes) {
      assert.ok((n.options || []).length <= 4);
      for (const o of n.options || []) assert.ok(o.label.length <= 48, o.label);
    }

    const a = analyzeStory(story);
    assert.equal(a.truncated, false, 'exploración truncada');
    const count = (t) => a.endings.filter((e) => e.type === t).length;
    assert.ok(count('good') >= 1, 'al menos 1 final bueno');
    assert.ok(count('bad') >= 3, 'al menos 3 finales malos');
    assert.deepEqual(a.endings.filter((e) => !e.reachable).map((e) => e.nodeId), [], 'finales inalcanzables');
    assert.deepEqual(a.unreachableNodes, [], 'nodos inalcanzables');
    assert.deepEqual(a.trapNodes, [], 'nodos trampa');
  });
}

test('index.json coincide con los ficheros', () => {
  const r = validateIndex(load('index.json'), stories);
  assert.deepEqual(r.errors, []);
});
