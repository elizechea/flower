// localStorage wrapper: prefix, schema envelope, in-memory fallback.
export const PREFIX = 'terminal:v1:';
export const SCHEMA = 1;

function pickBacking(backing) {
  try {
    const b = backing === undefined ? globalThis.localStorage : backing;
    if (!b) return null;
    const probe = PREFIX + 'probe';
    b.setItem(probe, '1');
    b.removeItem(probe);
    return b;
  } catch {
    return null;
  }
}

export function createStorage(backing) {
  const real = pickBacking(backing);
  const mem = new Map();
  const storage = {
    // false -> show the discreet "progress will not be saved" warning
    isPersistent: !!real,
    get(key) {
      let raw;
      try {
        raw = mem.get(PREFIX + key) ?? (real ? real.getItem(PREFIX + key) : null);
        if (raw == null) return null;
        const env = JSON.parse(raw);
        return env && env.v === SCHEMA && 'd' in env ? env.d : null; // unknown schema = absent
      } catch {
        return null;
      }
    },
    set(key, value) {
      const raw = JSON.stringify({ v: SCHEMA, d: value });
      if (real) {
        try { real.setItem(PREFIX + key, raw); return true; } catch { storage.isPersistent = false; }
      }
      mem.set(PREFIX + key, raw);
      return false;
    },
    remove(key) {
      try { if (real) real.removeItem(PREFIX + key); } catch { /* ignore */ }
      mem.delete(PREFIX + key);
    },
  };
  return storage;
}
