// Genera icons/ (SVG + PNG) sin dependencias: glifo ">_" verde sobre negro.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [3, 10, 3], FG = [57, 255, 20];
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

// Glifo en coordenadas 0..100: ">" como dos trazos y "_" como barra. `s` escala (maskable = zona segura).
function shapes(s) {
  const t = (x, y) => [50 + (x - 50) * s, 50 + (y - 50) * s];
  const th = 9 * s;
  const seg = (a, b) => ({ a: t(...a), b: t(...b), th });
  return {
    lines: [seg([22, 30], [48, 50]), seg([48, 50], [22, 70])],
    bar: { x: t(54, 0)[0], y: t(0, 69)[1], w: 26 * s, h: th },
  };
}

function svg(s, rounded) {
  const { lines, bar } = shapes(s);
  const p = lines.map((l) => `<line x1="${l.a[0]}" y1="${l.a[1]}" x2="${l.b[0]}" y2="${l.b[1]}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100"${rounded ? ' rx="18"' : ''} fill="${hex(BG)}"/>` +
    `<g stroke="${hex(FG)}" stroke-width="${lines[0].th}" stroke-linecap="square">${p}</g>` +
    `<rect x="${bar.x}" y="${bar.y}" width="${bar.w}" height="${bar.h}" fill="${hex(FG)}"/></svg>\n`;
}

const distSeg = (px, py, { a, b }) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const u = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - a[0] - u * dx, py - a[1] - u * dy);
};

function crc32(buf) {
  let c, crc = ~0;
  for (const byte of buf) { c = (crc ^ byte) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return ~crc >>> 0;
}
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
};

function png(size, s) {
  const { lines, bar } = shapes(s);
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const k = 100 / size;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) * k, py = (y + 0.5) * k;
      const on = lines.some((l) => distSeg(px, py, l) <= l.th / 2) ||
        (px >= bar.x && px <= bar.x + bar.w && py >= bar.y && py <= bar.y + bar.h);
      raw.set(on ? FG : BG, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const dir = new URL('../icons/', import.meta.url);
mkdirSync(dir, { recursive: true });
const out = (name, data) => writeFileSync(new URL(name, dir), data);
out('icon.svg', svg(1, true));
out('icon-192.png', png(192, 1));
out('icon-512.png', png(512, 1));
out('icon-maskable-512.png', png(512, 0.7)); // contenido dentro del 80% central
out('apple-touch-icon.png', png(180, 0.85));
