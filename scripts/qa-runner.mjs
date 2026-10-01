// QA Runner para Seven Save - Recorre las 25 rutas del brief en 4 viewports
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const SIZES = [1440, 1280, 768, 390];
const OUT_DIR = path.resolve('.playwright-mcp');
const LOG_DIR = path.resolve('scratch/qa');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const PREFIX = process.argv[2] || 'qa3';

const ROUTE_DEFS = [
  { url: '/login', name: 'login', full: false },
  { url: '/dashboard', name: 'dashboard', full: false },
  { url: '/gerencia', name: 'gerencia', full: false },
  { url: '/agenda', name: 'agenda', full: false },
  { url: '/calendario', name: 'calendario', full: false },
  { url: '/contratos', name: 'contratos', full: false },
  { url: '/empresas', name: 'empresas', full: false },
  { url: '/empresas/EMP-01', name: 'empresas-emp-01', full: false },
  { url: '/subcontratos', name: 'subcontratos', full: false },
  { url: '/obligaciones', name: 'obligaciones', full: false },
  { url: '/ejecucion', name: 'ejecucion', full: false },
  { url: '/pagos', name: 'pagos', full: false },
  { url: '/garantias', name: 'garantias', full: false },
  { url: '/aseguradoras', name: 'aseguradoras', full: false },
  { url: '/documentos', name: 'documentos', full: false },
  { url: '/actas', name: 'actas', full: false },
  { url: '/modificaciones', name: 'modificaciones', full: false },
  { url: '/alertas', name: 'alertas', full: false },
  { url: '/riesgos', name: 'riesgos', full: false },
  { url: '/incumplimientos', name: 'incumplimientos', full: false },
  { url: '/auditoria', name: 'auditoria', full: false },
  { url: '/reportes', name: 'reportes', full: false },
  { url: '/configuracion', name: 'configuracion', full: false },
  { url: '/contrato/CT-01', name: 'contrato-ct-01', full: false },
  { url: '/ruta-inexistente', name: 'ruta-inexistente', full: false }
];

const ROUTES = ROUTE_DEFS.map(r => ({
  url: r.url,
  stem: `${PREFIX}-${r.name}`,
  full: r.full
}));

console.log(`[QA RUNNER] Iniciando auditoría Playwright en ${ROUTES.length} rutas a través de 4 resoluciones: ${SIZES.join(', ')} con prefijo ${PREFIX}...`);

const report = [];
const browser = await chromium.launch({ headless: true });

try {
  for (let idx = 0; idx < ROUTES.length; idx++) {
    const route = ROUTES[idx];
    const itemReport = {
      index: idx + 1,
      url: route.url,
      stem: route.stem,
      viewports: {}
    };

    console.log(`\n[${idx + 1}/${ROUTES.length}] Auditando: ${route.url} (${route.stem})`);

    for (const width of SIZES) {
      const height = width === 390 ? 844 : width === 768 ? 1024 : width === 1280 ? 800 : 900;
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 1,
        locale: 'es-CO'
      });

      // Bypass de login para todas las rutas excepto /login
      if (!route.url.startsWith('/login')) {
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
        await page.goto(BASE + route.url, { waitUntil: 'networkidle', timeout: 30000 });
      } catch (e) {
        // Ignorar timeout de networkidle si responde el DOM
      }

      await page.waitForTimeout(2000);

      const filePath = path.join(OUT_DIR, `${route.stem}-${width}.png`);
      await page.screenshot({ path: filePath, fullPage: route.full });

      itemReport.viewports[width] = {
        file: filePath,
        consoleErrors,
        failedRequests
      };

      if (consoleErrors.length > 0) {
        console.warn(`  ⚠️ [${width}px] ${consoleErrors.length} errores de consola:`, consoleErrors[0]);
      }
      if (failedRequests.length > 0) {
        console.warn(`  ⚠️ [${width}px] ${failedRequests.length} peticiones fallidas:`, failedRequests[0]);
      }

      await context.close();
    }

    report.push(itemReport);
    console.log(`  ✓ Capturas completadas para ${route.stem}`);
  }
} finally {
  await browser.close();
}

const reportPath = path.join(LOG_DIR, `${PREFIX}-results.json`);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
console.log(`\n[QA RUNNER] Auditoría completa. Resultados guardados en: ${reportPath}`);
