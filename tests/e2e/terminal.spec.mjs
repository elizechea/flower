// E2E (spec §9): servidor estático bajo /terminal/, Chromium 390x844.
import { test, expect } from '@playwright/test';

const SETTINGS_KEY = 'terminal:v1:settings';
const STORY = 'nave-a-la-deriva';
const ROUTES = [
  [STORY, 'a.a.b.a', 'bad'],
  [STORY, 'a.b.a.d.a.a.b.a.a.c.c.a.a.a.a.c.a', 'good'],
  ['colonia-kepler-9', 'a.d.a.b.d.a.a', 'good'],
  ['senal-en-el-vacio', 'a.b.a.a.a.a.a.b.a.a.a', 'good'],
  ['protocolo-hal-iota', 'b.b.a.a.a.a.a.a.a', 'good'],
];

// Ajustes iniciales solo si no hay (así los cambios hechos en la página sobreviven a reload).
const seed = (page, d) => page.addInitScript(([k, d]) => {
  if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ v: 1, d }));
}, [SETTINGS_KEY, { sound: true, speed: 'instant', ...d }]);
const setSettings = (page, d) => page.evaluate(([k, d]) => localStorage.setItem(k, JSON.stringify({ v: 1, d })), [SETTINGS_KEY, { sound: true, speed: 'instant', ...d }]);

// Recoge errores de consola, excepciones, respuestas >= 400 y peticiones a otros dominios.
function watch(page, baseURL) {
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => problems.push('failed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
  page.on('request', (r) => { if (/^https?:/.test(r.url()) && !r.url().startsWith(baseURL)) problems.push('externa: ' + r.url()); });
  return problems;
}

const options = (page) => page.locator('#options button[data-option-id]');
const optionIds = (page) => options(page).evaluateAll((bs) => bs.map((b) => b.dataset.optionId));
// Texto visible del log (sin los span.sr-only, que ya tienen el párrafo entero).
const visibleLen = (page) => page.evaluate(() => [...document.querySelectorAll('#log p')]
  .flatMap((p) => [...p.childNodes]).filter((n) => !n.classList?.contains('sr-only'))
  .map((n) => n.textContent).join('').length);

async function startStory(page, storyId = STORY) {
  await page.goto(`#/new/${storyId}`);
  await page.waitForURL(/#\/play\//);
}
async function choose(page, id) {
  await options(page).first().waitFor();
  await page.locator(`#options button[data-option-id="${id}"]`).click();
}
async function play(page, path) {
  for (const id of path.split('.')) await choose(page, id);
}

// 9. Sin errores de consola ni peticiones fallidas o externas en ningún test.
test.beforeEach(async ({ page, baseURL }) => { page.problems = watch(page, baseURL); });
test.afterEach(async ({ page }) => { expect(page.problems).toEqual([]); });

test('1. el selector muestra las 4 historias', async ({ page }) => {
  await seed(page);
  await page.goto('#/');
  await expect(page.locator('body')).toHaveAttribute('data-view', 'home');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('story')).toHaveCount(4);
  await expect(page.locator(`[data-story-id="${STORY}"] .st-meta`)).toHaveText(/★☆☆ · 6 min · Finales: 0\/\d+/);
  expect(await page.getByTestId('story').evaluateAll((bs) => bs.map((b) => b.dataset.storyId)))
    .toEqual([STORY, 'colonia-kepler-9', 'senal-en-el-vacio', 'protocolo-hal-iota']);
});

test('2. el texto aparece progresivamente; tocar la pantalla lo completa y salen las opciones', async ({ page }) => {
  await seed(page, { speed: 'slow' });
  await startStory(page);
  await expect(page.locator('body')).toHaveAttribute('data-typing', '1');
  const n1 = await visibleLen(page);
  await expect.poll(() => visibleLen(page)).toBeGreaterThan(n1);
  const n2 = await visibleLen(page);
  expect(await options(page).count()).toBe(0);
  await page.locator('#screen').click();
  await expect(page.locator('body')).toHaveAttribute('data-typing', '0');
  await expect(options(page).first()).toBeVisible({ timeout: 2000 }); // imposible si siguiera tecleando a 55 ms/carácter
  expect(await visibleLen(page)).toBeGreaterThan(n2);
  expect(await page.locator('#log span.sr-only').count()).toBe(0);
});

test('3. elegir una opción teclea "> ..." y llega el siguiente nodo', async ({ page }) => {
  await seed(page);
  await startStory(page);
  await options(page).first().waitFor();
  const first = await optionIds(page);
  await expect(options(page).first()).toHaveText(/^\[1\] /);
  const before = await page.locator('#log p').count();
  await choose(page, 'b');
  await expect(page.locator('#log p.echo').last()).toHaveText('> Salir de la cápsula');
  await options(page).first().waitFor();
  expect(await page.locator('#log p').count()).toBeGreaterThan(before + 1);
  expect(await optionIds(page)).not.toEqual(first);
  expect(page.url()).toMatch(/#\/play\/nave-a-la-deriva\/[a-z0-9]{8,10}\?l=b$/);
});

for (const [storyId, path, type] of ROUTES) {
  test(`4. ruta fija hasta un final ${type} en ${storyId}`, async ({ page }) => {
    await seed(page);
    await startStory(page, storyId);
    await play(page, path);
    const ending = page.getByTestId('ending');
    await expect(ending).toHaveAttribute('data-ending-type', type);
    await expect(ending.locator('p.fin')).toHaveText(/^\*\*\* FIN: .+ \*\*\*$/);
    await expect(ending.locator('p.tag')).toHaveText(type === 'good' ? 'FINAL BUENO' : 'FINAL MALO');
    await expect(page.locator('body')).toHaveAttribute('data-view', 'ending');
    await expect(page.getByTestId('retry')).toBeVisible();
    await expect(page.getByTestId('other-stories')).toBeVisible();
    expect(await options(page).count()).toBe(0);
    await page.getByTestId('other-stories').click();
    await expect(page.locator(`[data-story-id="${storyId}"] .st-meta`)).toHaveText(/Finales: 1\/\d+/);
    expect(await page.getByTestId('continue').count()).toBe(0);
  });
}

test('5. recargar a mitad de partida restaura el historial sin teclear y con las mismas opciones', async ({ page }) => {
  await seed(page);
  await startStory(page);
  await play(page, 'a.b.a');
  await options(page).first().waitFor();
  const log = await page.locator('#log').innerText();
  const ids = await optionIds(page);
  const labels = await options(page).allInnerTexts();
  const url = page.url();
  await setSettings(page, { speed: 'slow' }); // si re-tecleara, tardaría decenas de segundos
  await page.reload();
  await expect(options(page).first()).toBeVisible({ timeout: 3000 });
  expect(await page.locator('#log').innerText()).toBe(log);
  expect(await optionIds(page)).toEqual(ids);
  expect(await options(page).allInnerTexts()).toEqual(labels);
  expect(await page.locator('#log p.echo').count()).toBe(3);
  expect(page.url()).toBe(url);
  await expect(page.locator('body')).toHaveAttribute('data-typing', '0');
});

test('5b. una versión guardada distinta se reproduce igualmente; un enlace con otra historia vuelve a la suya', async ({ page }) => {
  await seed(page);
  await startStory(page);
  await play(page, 'a');
  await options(page).first().waitFor();
  const url = page.url();
  const sessionId = url.match(/#\/play\/[^/]+\/([a-z0-9]+)/)[1];
  await page.evaluate((id) => {
    const k = 'terminal:v1:session:' + id;
    const env = JSON.parse(localStorage.getItem(k));
    env.d.storyVersion = 99;
    localStorage.setItem(k, JSON.stringify(env));
  }, sessionId);
  await page.reload();
  await options(page).first().waitFor();
  expect(await page.locator('#log p.echo').allInnerTexts()).toEqual(['> HABLAR --ORDENADOR']);
  expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('terminal:v1:session:' + id)).d.storyVersion, sessionId)).not.toBe(99);
  await page.goto(`#/play/colonia-kepler-9/${sessionId}`);
  await page.waitForURL(new RegExp(`#/play/${STORY}/${sessionId}`));
  await options(page).first().waitFor();
  expect(await page.locator('#log p.echo').allInnerTexts()).toEqual(['> HABLAR --ORDENADOR']);
});

test('6. la URL con ?l= reconstruye la partida en un contexto nuevo sin almacenamiento', async ({ page, browser, baseURL }) => {
  await seed(page);
  await startStory(page);
  await play(page, 'a.b');
  await options(page).first().waitFor();
  const url = page.url();
  expect(url).toMatch(/\?l=a\.b$/);
  const log = await page.locator('#log').innerText();
  const ids = await optionIds(page);

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx.newPage();
  const problems = watch(p2, baseURL);
  await seed(p2);
  await p2.goto(url);
  await options(p2).first().waitFor();
  expect(await p2.locator('#log').innerText()).toBe(log);
  expect(await optionIds(p2)).toEqual(ids);
  expect(await p2.locator('#log p.echo').allInnerTexts()).toEqual(['> HABLAR --ORDENADOR', expect.stringMatching(/^> /)]);
  // y además queda guardada: vuelve a aparecer en CONTINUAR
  await p2.goto('#/');
  await p2.getByTestId('start').click();
  await expect(p2.getByTestId('continue')).toHaveText(/NAVE A LA DERIVA · 2 decisiones/);
  expect(problems).toEqual([]);
  await ctx.close();
});

const AUDIO_SPY = () => {
  window.__osc = 0;
  const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  class FakeAudioContext {
    state = 'running';
    destination = {};
    get currentTime() { return performance.now() / 1000; }
    resume() { return Promise.resolve(); }
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
    createOscillator() {
      window.__osc++;
      return { frequency: param(), connect() {}, disconnect() {}, start() {}, stop() { setTimeout(() => this.onended?.(), 50); } };
    }
  }
  window.AudioContext = FakeAudioContext;
  window.webkitAudioContext = FakeAudioContext;
};

test('7a. sonido activado: nada antes del primer gesto; después se programan osciladores al teclear', async ({ page }) => {
  await page.addInitScript(AUDIO_SPY);
  await seed(page, { speed: 'normal' });
  await startStory(page);
  await expect(page.locator('body')).toHaveAttribute('data-typing', '1');
  expect(await page.evaluate(() => window.__osc)).toBe(0); // sin gesto no hay AudioContext (spec §8)
  await page.locator('#screen').click(); // primer gesto: desbloquea y salta el tecleo
  await options(page).first().waitFor();
  expect(await page.evaluate(() => window.__osc)).toBe(2); // solo el doble blip de las opciones
  await choose(page, 'a');
  await page.waitForFunction(() => window.__osc > 3); // click + blips del eco
});

test('7b. sonido desactivado: no se programa ningún oscilador', async ({ page }) => {
  await page.addInitScript(AUDIO_SPY);
  await seed(page, { speed: 'fast', sound: false });
  await startStory(page);
  await options(page).first().waitFor();
  await choose(page, 'a');
  await options(page).first().waitFor();
  await page.getByTestId('menu-btn').click();
  await expect(page.getByTestId('menu-sound')).toHaveText('Sonido OFF');
  expect(await page.evaluate(() => window.__osc)).toBe(0);
});

for (const [width, height] of [[360, 640], [390, 844]]) {
  test.describe(`${width}x${height}`, () => {
    test.use({ viewport: { width, height } });
    test('8. sin desbordamiento horizontal ni scroll de página', async ({ page }) => {
      await seed(page);
      const check = async (where) => {
        const m = await page.evaluate(() => {
          const d = document.documentElement, s = document.getElementById('screen');
          return { sw: d.scrollWidth, cw: d.clientWidth, sh: d.scrollHeight, ch: d.clientHeight, x: window.scrollX, y: window.scrollY, ssw: s.scrollWidth, scw: s.clientWidth };
        });
        expect(m.sw, where).toBeLessThanOrEqual(m.cw);
        expect(m.sh, where).toBeLessThanOrEqual(m.ch);
        expect(m.ssw, where).toBeLessThanOrEqual(m.scw);
        expect([m.x, m.y], where).toEqual([0, 0]);
        const app = await page.locator('#app').boundingBox();
        expect(app.width, where).toBeLessThanOrEqual(width);
        expect(app.height, where).toBeLessThanOrEqual(height);
      };
      await page.goto('#/');
      await page.getByTestId('start').click();
      await expect(page.getByTestId('story')).toHaveCount(4);
      await check('home');
      await startStory(page, 'protocolo-hal-iota');
      await play(page, 'b.b.a.a.a');
      await options(page).first().waitFor();
      await check('play');
      await page.getByTestId('menu-btn').click();
      await check('menu');
    });
  });
}

test('9. flujo completo con menú y teclado, sin errores de consola', async ({ page }) => {
  await seed(page);
  await page.goto('#/');
  await page.getByTestId('start').click();
  await page.locator(`[data-story-id="${STORY}"]`).click();
  await page.waitForURL(/#\/play\//);
  await options(page).first().waitFor();
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).toHaveAttribute('data-menu', '1');
  await expect(page.locator('#menu button')).toHaveText([
    '[ X ] Salir del menú', 'Reiniciar partida', 'Cambiar de historia', 'Sonido ON', 'Velocidad de texto: Instantánea',
    'Copiar enlace de la partida', 'Invitar jugadores — próximamente', 'Acerca de',
  ]);
  await expect(page.getByTestId('menu-invite')).toBeDisabled();
  await page.getByTestId('menu-sound').click();
  await expect(page.getByTestId('menu-sound')).toHaveText('Sonido OFF');
  await page.getByTestId('menu-speed').click();
  await expect(page.getByTestId('menu-speed')).toHaveText('Velocidad de texto: Muy lenta');
  await page.getByTestId('menu-about').click();
  await expect(page.locator('#menu .about')).toContainText('TERMINAL');
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).d, SETTINGS_KEY)).toEqual({ sound: false, speed: 'veryslow' });
  await page.getByTestId('menu-close').click();
  await expect(page.locator('#menu')).toBeHidden();
  await page.keyboard.press('1'); // elige la opción a; ahora teclea lento
  await expect(page.locator('body')).toHaveAttribute('data-typing', '1');
  await page.keyboard.press(' '); // salta el eco
  await expect(page.locator('#log p.echo').last()).toHaveText('> HABLAR --ORDENADOR');
  await expect(page.locator('body')).toHaveAttribute('data-typing', '1'); // empieza el nodo
  await page.keyboard.press('Enter'); // salta el nodo
  await expect(page.locator('body')).toHaveAttribute('data-typing', '0');
  await options(page).first().waitFor();
  await page.getByTestId('menu-btn').click();
  await page.getByTestId('menu-restart').click();
  await page.waitForURL(/#\/play\/nave-a-la-deriva\/[a-z0-9]+$/);
  await page.getByTestId('menu-btn').click();
  await page.getByTestId('menu-change-story').click();
  await expect(page.getByTestId('continue')).toHaveCount(1); // la partida reiniciada aún no tiene decisiones
});
