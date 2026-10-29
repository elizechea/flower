import { defineConfig } from '@playwright/test';

// El servidor monta el repo bajo /terminal/ para probar el despliegue en subruta (GitHub Pages).
const PORT = 8089;
const BASE = `http://127.0.0.1:${PORT}/terminal/`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: { baseURL: BASE, viewport: { width: 390, height: 844 }, hasTouch: true },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `node tools/serve.mjs ${PORT} /terminal/`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
  },
});
