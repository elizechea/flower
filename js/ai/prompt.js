// Modo IA: construcción del prompt y lectura de la respuesta del modelo. Puro, sin DOM ni red.

export const MODELS = [
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', key: 'light', size: '~1 GB' },
  { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', key: 'best', size: '~2 GB' },
];

const MAX_OPTIONS = 4;
const MAX_LABEL = 48;
// shortcut: la ventana de contexto del modelo es de 4096 tokens; se envían la apertura y los últimos
// HISTORY mensajes. Si las partidas largas pierden el hilo, añadir un resumen acumulado.
const HISTORY = 10;

// Esquema que fuerza la salida JSON (WebLLM lo convierte en gramática).
export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    texto: { type: 'array', items: { type: 'string' } },
    opciones: { type: 'array', items: { type: 'string' } },
    final: {
      type: 'object',
      properties: { tipo: { type: 'string', enum: ['ninguno', 'bueno', 'malo'] }, titulo: { type: 'string' } },
      required: ['tipo', 'titulo'],
    },
  },
  required: ['texto', 'opciones', 'final'],
};

export function systemPrompt(story) {
  return `Eres el ordenador de a bordo y el narrador de una aventura conversacional de ciencia ficción que se juega en un terminal de fósforo verde de los años 80.

ESCENARIO:
${story.prompt}

REGLAS:
- Escribe siempre en español, en segunda persona, con frases cortas y voz de ordenador: mensajes de sistema en MAYÚSCULAS, códigos de error, lecturas de sensores.
- Cada respuesta tiene de 1 a 3 párrafos muy breves (60 palabras en total como máximo).
- Ofrece de 2 a 4 opciones de acción de menos de ${MAX_LABEL} caracteres. Pueden ser comandos, como "> DIAGNOSTICO --REACTOR".
- El jugador puede elegir una opción o escribir lo que quiera. Interpreta su acción con coherencia y dale consecuencias reales.
- Puedes cambiar la historia como quieras: giros, traiciones, revelaciones. Pero mantén la coherencia con lo ya contado.
- Las malas decisiones pueden llevar a la muerte o al desastre. Llega a un final en 8 a 15 turnos.
- Cuando la historia termine, pon "final" con "tipo" "bueno" o "malo" y un "titulo" corto en MAYÚSCULAS, y deja "opciones" vacío. Mientras no termine, "tipo" es "ninguno" y "titulo" vacío.

Responde SOLO con JSON: {"texto": ["párrafo", ...], "opciones": ["opción", ...], "final": {"tipo": "ninguno", "titulo": ""}}`;
}

export const START = 'INICIAR SESIÓN';

/** Mensajes para el modelo: sistema + apertura + últimos turnos. transcript = [{role, content}]. */
export function buildMessages(story, transcript) {
  const head = transcript.slice(0, 2); // petición inicial y apertura de la historia
  const tail = transcript.slice(Math.max(2, transcript.length - HISTORY));
  return [{ role: 'system', content: systemPrompt(story) }, ...head, ...tail];
}

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

/**
 * Respuesta del modelo -> { paragraphs, options, ending|null }. Nunca lanza: si no es JSON válido,
 * el texto en bruto se muestra como narración y se ofrece continuar.
 */
export function parseReply(raw) {
  let j = null;
  try { j = JSON.parse(raw); } catch { /* texto libre */ }
  if (!j || typeof j !== 'object') {
    const text = String(raw || '').trim();
    return { paragraphs: text ? [text] : ['...'], options: ['Continuar'], ending: null };
  }
  const list = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : [])
    .map((x) => String(x).trim()).filter(Boolean);
  const paragraphs = list(j.texto);
  const tipo = j.final && j.final.tipo;
  const ending = tipo === 'bueno' || tipo === 'malo'
    ? { type: tipo === 'bueno' ? 'good' : 'bad', title: String(j.final.titulo || '').trim().toUpperCase() || 'FIN' }
    : null;
  let options = [...new Set(list(j.opciones).map((o) => clip(o, MAX_LABEL)))].slice(0, MAX_OPTIONS);
  if (ending) options = [];
  else if (!options.length) options = ['Continuar'];
  return { paragraphs: paragraphs.length ? paragraphs : ['...'], options, ending };
}
