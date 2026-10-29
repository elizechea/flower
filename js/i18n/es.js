// Todos los textos de interfaz en español. Claves con punto: t('menu.continue').

const strings = {
  title: 'TERMINAL',
  start: '[ TOCA PARA INICIAR ]',
  home: {
    continue: 'CONTINUAR',
  },
  menu: {
    continue: 'Continuar',
    restart: 'Reiniciar partida',
    changeStory: 'Cambiar de historia',
    soundOn: 'Sonido ON',
    soundOff: 'Sonido OFF',
    textSpeed: 'Velocidad de texto',
    speedSlow: 'Lenta',
    speedNormal: 'Normal',
    speedFast: 'Rápida',
    speedInstant: 'Instantánea',
    copyLink: 'Copiar enlace de la partida',
    invite: 'Invitar jugadores — próximamente',
    about: 'Acerca de',
  },
  ending: {
    good: 'FINAL BUENO',
    bad: 'FINAL MALO',
    neutral: 'FINAL NEUTRO',
    title: '*** FIN: {title} ***',
    retry: '[ REINTENTAR ]',
    otherStories: '[ OTRAS HISTORIAS ]',
  },
  stories: {
    locked: '[BLOQUEADO]',
    endings: 'Finales: {n}/{total}',
  },
  ui: {
    processing: 'Procesando',
    linkCopied: 'Enlace copiado',
  },
  notice: {
    storyChanged: 'La historia ha cambiado, la partida no es recuperable',
    memoryOnly: 'Sin almacenamiento del navegador: la partida solo se guarda mientras dure esta sesión.',
  },
  error: {
    storiesLoad: 'No se pudieron cargar las historias.',
    storyLoad: 'No se pudo cargar la historia.',
  },
};

/**
 * Texto de una clave con punto. {param} se sustituye por params.param.
 * Clave inexistente: devuelve la propia clave, para que la UI no se rompa.
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 * @returns {string}
 */
export function t(key, params = {}) {
  const text = key.split('.').reduce((node, k) => node?.[k], strings);
  if (typeof text !== 'string') return key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

export default strings;
