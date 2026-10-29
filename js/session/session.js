// Session persistence (log of choices), index, endings, settings, URL log codec. No DOM.
const SPEEDS = ['slow', 'normal', 'fast', 'instant'];
export const DEFAULT_SETTINGS = { sound: true, speed: 'normal' };

export function newSessionId() {
  const b = new Uint8Array(9);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => (x % 36).toString(36)).join('');
}

export function createSessionStore(storage, clock = () => Date.now()) {
  const index = () => storage.get('index') || [];

  const store = {
    saveSession(id, { storyId, storyVersion, log, status }) {
      const prev = storage.get('session:' + id);
      const now = clock();
      const s = { storyId, storyVersion, createdAt: prev ? prev.createdAt : now, updatedAt: now, log: [...log], status };
      storage.set('session:' + id, s);
      storage.set('index', [{ id, storyId, updatedAt: now }, ...index().filter((e) => e.id !== id)]);
      return s;
    },
    loadSession(id) {
      const s = storage.get('session:' + id);
      return s && typeof s === 'object' && Array.isArray(s.log) ? s : null;
    },
    removeSession(id) {
      storage.remove('session:' + id);
      storage.set('index', index().filter((e) => e.id !== id));
    },
    // newest first: [{ id, storyId, updatedAt }]
    listSessions() {
      return index().sort((a, b) => b.updatedAt - a.updatedAt);
    },
    addEnding(storyId, nodeId) {
      const list = store.listEndings(storyId);
      if (!list.includes(nodeId)) storage.set('endings:' + storyId, [...list, nodeId]);
    },
    listEndings(storyId) {
      const l = storage.get('endings:' + storyId);
      return Array.isArray(l) ? l : [];
    },
    getSettings() {
      const s = storage.get('settings') || {};
      return {
        sound: typeof s.sound === 'boolean' ? s.sound : DEFAULT_SETTINGS.sound,
        speed: SPEEDS.includes(s.speed) ? s.speed : DEFAULT_SETTINGS.speed,
      };
    },
    saveSettings(patch) {
      storage.set('settings', { ...store.getSettings(), ...patch });
      return store.getSettings();
    },
  };
  return store;
}

const B64 = 'b64~';
const SAFE = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/;

const toB64 = (str) => {
  const bin = String.fromCharCode(...new TextEncoder().encode(str));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = (b) => {
  const bin = atob(b.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

// Short and URL-safe: "a.b.c". Otherwise "b64~" + base64url(JSON). Empty log -> "".
// shortcut: spread into fromCharCode caps at ~100k ids, far above any real log.
export function encodeLog(ids) {
  if (!ids.length) return '';
  const plain = ids.join('.');
  if (plain.length <= 120 && SAFE.test(plain) && ids.every((i) => !i.includes('.'))) return plain;
  return B64 + toB64(JSON.stringify(ids));
}

// Returns an array of ids, or null when the string is malformed.
export function decodeLog(str) {
  if (!str) return [];
  try {
    if (str.startsWith(B64)) {
      const ids = JSON.parse(fromB64(str.slice(B64.length)));
      return Array.isArray(ids) && ids.every((i) => typeof i === 'string') ? ids : null;
    }
    return SAFE.test(str) ? str.split('.') : null;
  } catch {
    return null;
  }
}
