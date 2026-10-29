// Servidor estático sin dependencias que monta el repo bajo una subruta (como GitHub Pages).
// Uso: node tools/serve.mjs [puerto] [subruta]   p. ej. node tools/serve.mjs 8089 /terminal/
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const port = Number(process.argv[2] || 8089);
const mount = process.argv[3] || '/terminal/';
const root = resolve(new URL('..', import.meta.url).pathname);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png',
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!path.startsWith(mount)) { res.writeHead(404); return res.end('fuera de la subruta ' + mount); }
  const file = resolve(root, path.slice(mount.length) + (path.endsWith('/') ? 'index.html' : ''));
  if (!file.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('no encontrado');
  }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}${mount}`));
