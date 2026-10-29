// Carga perezosa de WebLLM (https://github.com/mlc-ai/web-llm): solo se descarga al entrar en el modo IA.
// La librería viene del CDN con versión fija; los pesos del modelo los descarga y cachea la propia librería.
import { RESPONSE_SCHEMA } from './prompt.js';

export const WEBLLM_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/lib/index.js';

let current = null; // { modelId, engine: Promise }

/** true si el navegador expone WebGPU con un adaptador utilizable. */
export async function hasWebGPU() {
  try { return !!(navigator.gpu && await navigator.gpu.requestAdapter()); } catch { return false; }
}

/** Devuelve el motor del modelo, cargándolo (y descargándolo la primera vez). onProgress(0..1, texto). */
export function loadModel(modelId, onProgress = () => {}) {
  if (current && current.modelId === modelId) return current.engine;
  const prev = current;
  const engine = (async () => {
    if (prev) await prev.engine.then((e) => e.unload(), () => {});
    const webllm = await import(WEBLLM_URL);
    return webllm.CreateMLCEngine(modelId, {
      initProgressCallback: (r) => onProgress(r.progress || 0, r.text || ''),
    });
  })();
  current = { modelId, engine };
  engine.catch(() => { if (current && current.engine === engine) current = null; });
  return engine;
}

/** Una respuesta completa del modelo en formato JSON (texto en bruto). */
export async function complete(engine, messages) {
  const r = await engine.chat.completions.create({
    messages,
    temperature: 0.8,
    max_tokens: 400,
    response_format: { type: 'json_object', schema: JSON.stringify(RESPONSE_SCHEMA) },
  });
  return r.choices[0].message.content;
}
