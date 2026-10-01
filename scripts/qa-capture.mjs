// Captura QA de Seven Save con bypass de sesión.
// Uso:
//   node scripts/qa-capture.mjs --url /dashboard --out .playwright-mcp/qa2-dashboard [--sizes 1440,1280,768,390] [--full]
// Salida: PNG por viewport + resumen JSON en stdout (errores de consola y red).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};

const url = arg('url', '/dashboard');
const out = arg('out', 'scratch/qa/capture');
const sizes = (arg('sizes', '1440,1280,768,390')).split(',').map(Number);
const full = process.argv.includes('--full');
const BASE = 'http://localhost:3000';
const results = [];

const browser = await chromium.launch();
try {
  for (const width of sizes) {
    const height = width === 390 ? 844 : width === 768 ? 1024 : width === 1280 ? 800 : 900;
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      locale: 'es-CO',
    });

    // Bypass de login para todas las rutas excepto /login
    if (!url.startsWith('/login')) {
      await context.addInitScript(() => {
        window.localStorage.setItem('ss_auth_v1', '1');
      });
    } else {
      await context.addInitScript(() => {
        window.localStorage.removeItem('ss_auth_v1');
      });
    }

    const page = await context.newPage();
    const consoleErrors = [];
    const failedRequests = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
    });
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${String(err).slice(0, 300)}`));
    page.on('requestfailed', (req) =>
      failedRequests.push(`${req.failure()?.errorText || '?'} ${req.url().slice(0, 160)}`)
    );

    try {
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
    } catch {
      // networkidle puede no llegar; continuamos tras el timeout del goto
    }
    await page.waitForTimeout(2800);

    const file = `${out}-${width}.png`;
    const dir = path.dirname(path.resolve(file));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await page.screenshot({ path: file, fullPage: full });
    results.push({ url, width, file, consoleErrors, failedRequests });
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
