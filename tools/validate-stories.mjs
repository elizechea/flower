// Valida todas las historias y el índice. Sale con código 1 si hay errores.
import { readdirSync, readFileSync } from 'node:fs';
import { validateStory, validateIndex } from '../js/engine/validate.js';

const dir = new URL('../stories/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
let failed = 0;
const report = (label, r) => {
  console.log(`${r.ok ? 'OK   ' : 'ERROR'} ${label}`);
  for (const e of r.errors) console.log(`  [${e.code}] ${e.message}`);
  for (const w of r.warnings) console.log(`  (aviso) [${w.code}] ${w.message}`);
  if (!r.ok) failed++;
};

const stories = [];
for (const f of files) {
  let story;
  try { story = JSON.parse(readFileSync(new URL(f, dir), 'utf8')); } catch (e) {
    report(f, { ok: false, errors: [{ code: 'JSON_INVALID', message: e.message }], warnings: [] });
    continue;
  }
  stories.push(story);
  const r = validateStory(story);
  if (story.id !== f.replace(/\.json$/, '')) {
    r.errors.push({ code: 'FILE_NAME_MISMATCH', message: `El fichero ${f} debe llamarse "${story.id}.json".` });
    r.ok = false;
  }
  report(f, r);
}

try {
  report('index.json', validateIndex(JSON.parse(readFileSync(new URL('index.json', dir), 'utf8')), stories));
} catch (e) {
  report('index.json', { ok: false, errors: [{ code: 'INDEX_UNREADABLE', message: e.message }], warnings: [] });
}

console.log(failed ? `\n${failed} con errores.` : `\nTodo correcto (${files.length} historias).`);
process.exit(failed ? 1 : 0);
