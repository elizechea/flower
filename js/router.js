// Rutas por hash (spec §6). Funciones puras, sin DOM.
const STORY_ID = /^[a-z0-9-]+$/;
// shortcut: sessionId solo en minúsculas; si algún día se aceptan mayúsculas, ampliar aquí
const SESSION_ID = /^[a-z0-9]{8,10}$/;

export function parseHash(hash = '') {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const [name, storyId, sessionId] = parts;
  if (name === 'play' && parts.length === 3 && STORY_ID.test(storyId) && SESSION_ID.test(sessionId)) {
    const log = new URLSearchParams(query).get('l');
    return log ? { name, storyId, sessionId, log } : { name, storyId, sessionId };
  }
  if (name === 'new' && parts.length === 2 && STORY_ID.test(storyId)) return { name, storyId };
  // Modo IA: #/ai/<historia> crea sesión; #/ai/<historia>/<sesión> es la partida.
  if (name === 'ai' && parts.length === 2 && STORY_ID.test(storyId)) return { name: 'ai-new', storyId };
  if (name === 'ai' && parts.length === 3 && STORY_ID.test(storyId) && SESSION_ID.test(sessionId)) return { name, storyId, sessionId };
  return { name: 'home' };
}

export function hashFor(route) {
  if (route.name === 'play') {
    const query = route.log ? `?l=${encodeURIComponent(route.log)}` : '';
    return `#/play/${route.storyId}/${route.sessionId}${query}`;
  }
  if (route.name === 'new') return `#/new/${route.storyId}`;
  if (route.name === 'ai-new') return `#/ai/${route.storyId}`;
  if (route.name === 'ai') return `#/ai/${route.storyId}/${route.sessionId}`;
  return '#/';
}
