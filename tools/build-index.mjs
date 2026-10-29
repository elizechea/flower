// Regenera stories/index.json a partir de stories/*.json (orden: dificultad, título).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../stories/', import.meta.url);
const stories = readdirSync(dir)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .sort()
  .map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));

const entries = stories
  .map((s) => ({
    id: s.id, file: `${s.id}.json`, title: s.title, tagline: s.tagline,
    difficulty: s.difficulty, estimatedMinutes: s.estimatedMinutes, version: s.version,
  }))
  .sort((a, b) => a.difficulty - b.difficulty || a.title.localeCompare(b.title, 'es') || a.id.localeCompare(b.id));

writeFileSync(new URL('index.json', dir), JSON.stringify({ schemaVersion: 1, stories: entries }, null, 2) + '\n');
console.log(`stories/index.json: ${entries.length} historias`);
