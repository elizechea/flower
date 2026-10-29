// E2E del modo IA con un WebLLM falso (se intercepta la URL del CDN) y WebGPU simulado.
import { test, expect } from '@playwright/test';
import { WEBLLM_URL } from '../../js/ai/llm.js';

const SETTINGS = ['terminal:v1:settings', JSON.stringify({ v: 1, d: { sound: true, speed: 'instant' } })];

// Termina la historia cuando el jugador ha hablado dos veces (además del INICIAR SESIÓN).
const FAKE_WEBLLM = `
export async function CreateMLCEngine(id, { initProgressCallback }) {
  initProgressCallback({ progress: 0.5 }); initProgressCallback({ progress: 1 });
  window.__model = id;
  return { unload() {}, chat: { completions: { async create({ messages }) {
    window.__calls = (window.__calls || 0) + 1;
    window.__last = messages;
    const said = messages.filter((m) => m.role === 'user').length - 1;
    const reply = said >= 2
      ? { texto: ['La nave atraca. Todos vivos.'], opciones: [], final: { tipo: 'bueno', titulo: 'A puerto' } }
      : { texto: ['TURNO ' + said + '. MULE NO RESPONDE.'], opciones: ['> ABRIR BODEGA', '> LLAMAR A MULE'], final: { tipo: 'ninguno', titulo: '' } };
    return { choices: [{ message: { content: JSON.stringify(reply) } }] };
  } } } };
}`;

async function setup(page, { gpu = true } = {}) {
  await page.addInitScript(([k, v, gpu]) => {
    if (!localStorage.getItem(k)) localStorage.setItem(k, v);
    Object.defineProperty(navigator, 'gpu', { value: gpu ? { requestAdapter: async () => ({}) } : undefined, configurable: true });
  }, [...SETTINGS, gpu]);
  await page.route(WEBLLM_URL, (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_WEBLLM }));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

test('el selector muestra la sección MODO IA', async ({ page }) => {
  await setup(page);
  await page.goto('#/');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('ai-story')).toHaveCount(3);
});

test('partida IA: modelo, opciones, texto libre, recarga y final', async ({ page }) => {
  const errors = await setup(page);
  await page.goto('#/ai/carguero-argo');
  await page.waitForURL(/#\/ai\/carguero-argo\/[a-z0-9]+$/);
  await page.getByTestId('model').first().click();
  await expect(page.locator('#log')).toContainText('TURNO 0. MULE NO RESPONDE.');
  expect(await page.evaluate(() => window.__model)).toBe('Qwen2.5-1.5B-Instruct-q4f16_1-MLC');

  await page.locator('#options button[data-option-id="b"]').click();
  await expect(page.locator('#log p.echo').last()).toHaveText('> LLAMAR A MULE');
  await expect(page.locator('#log')).toContainText('TURNO 1.');

  // Recarga: la conversación se pinta sin volver a llamar al modelo.
  await page.reload();
  await expect(page.locator('#log')).toContainText('TURNO 1.');
  await expect(page.locator('#options button[data-option-id]')).toHaveCount(2);
  expect(await page.evaluate(() => window.__calls)).toBeUndefined();

  // Texto libre: los atajos 1-4 no se disparan mientras se escribe.
  await page.getByTestId('say').fill('');
  await page.getByTestId('say').pressSequentially('abro la escotilla 1');
  await page.getByTestId('say').press('Enter');
  await expect(page.locator('#log p.echo').last()).toHaveText('> abro la escotilla 1');
  await expect(page.getByTestId('ending')).toContainText('*** FIN: A PUERTO ***');
  await expect(page.getByTestId('retry')).toBeVisible();
  const last = await page.evaluate(() => window.__last);
  expect(last[0].role).toBe('system');
  expect(last.at(-1)).toEqual({ role: 'user', content: 'abro la escotilla 1' });
  expect(errors).toEqual([]);
});

test('sin WebGPU avisa y no descarga nada', async ({ page }) => {
  await setup(page, { gpu: false });
  let fetched = false;
  page.on('request', (r) => { if (r.url() === WEBLLM_URL) fetched = true; });
  await page.goto('#/ai/estacion-eco');
  await expect(page.locator('#log')).toContainText('NO TIENE WEBGPU');
  expect(fetched).toBe(false);
});
