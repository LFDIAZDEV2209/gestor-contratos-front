// QA Runner Pass 4 — matriz completa "después" de la ola modal→vista.
// 25 rutas base + ~40 rutas nuevas (creación/edición/fichas) × 4 viewports.
// Uso: node scripts/qa-runner-pass4.mjs [prefijo]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const SIZES = [1440, 1280, 768, 390];
const OUT_DIR = path.resolve('.playwright-mcp');
const LOG_DIR = path.resolve('scratch/qa');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const PREFIX = process.argv[2] || 'pass4';

// IDs demo reales (lib/demo.ts): EMP-01..05, U1..U8, IN-01..04, PM-01..03,
// RG-01.., EN-01.., OB-01.., PG-1.., SC-01.., EX-CT-01-1, DC-01..
const ROUTE_DEFS = [
  // — Base (25) —
  { url: '/login', name: 'login' },
  { url: '/dashboard', name: 'dashboard' },
  { url: '/gerencia', name: 'gerencia' },
  { url: '/agenda', name: 'agenda' },
  { url: '/calendario', name: 'calendario' },
  { url: '/contratos', name: 'contratos' },
  { url: '/empresas', name: 'empresas' },
  { url: '/empresas/EMP-01', name: 'empresas-emp-01' },
  { url: '/subcontratos', name: 'subcontratos' },
  { url: '/obligaciones', name: 'obligaciones' },
  { url: '/ejecucion', name: 'ejecucion' },
  { url: '/pagos', name: 'pagos' },
  { url: '/garantias', name: 'garantias' },
  { url: '/aseguradoras', name: 'aseguradoras' },
  { url: '/documentos', name: 'documentos' },
  { url: '/actas', name: 'actas' },
  { url: '/modificaciones', name: 'modificaciones' },
  { url: '/alertas', name: 'alertas' },
  { url: '/riesgos', name: 'riesgos' },
  { url: '/incumplimientos', name: 'incumplimientos' },
  { url: '/auditoria', name: 'auditoria' },
  { url: '/reportes', name: 'reportes' },
  { url: '/configuracion', name: 'configuracion' },
  { url: '/contrato/CT-01', name: 'contrato-ct-01' },
  { url: '/ruta-inexistente', name: 'ruta-inexistente' },
  // — Creación global (modal → vista) —
  { url: '/contratos/nuevo', name: 'contratos-nuevo' },
  { url: '/empresas/nueva', name: 'empresas-nueva' },
  { url: '/documentos/nuevo', name: 'documentos-nuevo' },
  { url: '/actas/nueva', name: 'actas-nueva' },
  { url: '/garantias/nueva', name: 'garantias-nueva' },
  { url: '/ejecucion/nueva', name: 'ejecucion-nueva' },
  { url: '/pagos/nuevo', name: 'pagos-nuevo' },
  { url: '/modificaciones/nueva', name: 'modificaciones-nueva' },
  { url: '/incumplimientos/nuevo', name: 'incumplimientos-nuevo' },
  { url: '/incumplimientos/planes/nuevo', name: 'planes-nuevo' },
  { url: '/riesgos/nuevo', name: 'riesgos-nuevo' },
  { url: '/subcontratos/nuevo', name: 'subcontratos-nuevo' },
  { url: '/aseguradoras/cupos/nuevo', name: 'cupos-nuevo' },
  { url: '/alertas/tareas/nueva', name: 'tareas-nueva' },
  { url: '/configuracion/usuarios/nuevo', name: 'usuarios-nuevo' },
  // — Edición / fichas —
  { url: '/empresas/EMP-01/editar', name: 'empresas-emp01-editar' },
  { url: '/configuracion/usuarios/U1/editar', name: 'usuarios-u1-editar' },
  { url: '/incumplimientos/IN-01/editar', name: 'incumplimientos-in01-editar' },
  { url: '/incumplimientos/planes/PM-01/editar', name: 'planes-pm01-editar' },
  { url: '/riesgos/RG-01/editar', name: 'riesgos-rg01-editar' },
  { url: '/subcontratos/SC-01/editar', name: 'subcontratos-sc01-editar' },
  { url: '/obligaciones/OB-01', name: 'obligaciones-ob01' },
  { url: '/documentos/DC-01', name: 'documentos-dc01' },
  { url: '/documentos/DC-01/versiones/nueva', name: 'documentos-dc01-versiones-nueva' },
  { url: '/reportes/r_general', name: 'reportes-r-general' },
  { url: '/reportes/r_pagos', name: 'reportes-r-pagos' },
  { url: '/contrato/CT-01/editar', name: 'contrato-ct01-editar' },
  { url: '/contrato/CT-01/validacion', name: 'contrato-ct01-validacion' },
  { url: '/contrato/CT-01/conciliacion', name: 'contrato-ct01-conciliacion' },
  // — Alta por recurso del expediente —
  { url: '/contrato/CT-01/actas/nueva', name: 'ct01-actas-nueva' },
  { url: '/contrato/CT-01/documentos/nueva', name: 'ct01-documentos-nueva' },
  { url: '/contrato/CT-01/ejecucion/nueva', name: 'ct01-ejecucion-nueva' },
  { url: '/contrato/CT-01/entregables/nueva', name: 'ct01-entregables-nueva' },
  { url: '/contrato/CT-01/garantias/nueva', name: 'ct01-garantias-nueva' },
  { url: '/contrato/CT-01/incumplimientos/nueva', name: 'ct01-incumplimientos-nueva' },
  { url: '/contrato/CT-01/modificaciones/nueva', name: 'ct01-modificaciones-nueva' },
  { url: '/contrato/CT-01/obligaciones/nueva', name: 'ct01-obligaciones-nueva' },
  { url: '/contrato/CT-01/pagos/nueva', name: 'ct01-pagos-nueva' },
  { url: '/contrato/CT-01/planes/nueva', name: 'ct01-planes-nueva' },
  { url: '/contrato/CT-01/prorrogas/nueva', name: 'ct01-prorrogas-nueva' },
  { url: '/contrato/CT-01/reinicios/nueva', name: 'ct01-reinicios-nueva' },
  { url: '/contrato/CT-01/riesgos/nueva', name: 'ct01-riesgos-nueva' },
  { url: '/contrato/CT-01/subcontratos/nueva', name: 'ct01-subcontratos-nueva' },
  { url: '/contrato/CT-01/suspensiones/nueva', name: 'ct01-suspensiones-nueva' },
  // — Edición de hijos del expediente (ids demo derivados) —
  { url: '/contrato/CT-01/ejecucion/EX-CT-01-1/editar', name: 'ct01-exec-editar' },
  { url: '/contrato/CT-01/entregables/EN-01/editar', name: 'ct01-entregable-editar' },
  { url: '/contrato/CT-01/entregables/EN-01/entrega/editar', name: 'ct01-entrega-editar' },
  { url: '/contrato/CT-01/incumplimientos/IN-02/editar', name: 'ct01-incumplimiento-editar' },
  { url: '/contrato/CT-01/planes/PM-02/editar', name: 'ct01-plan-editar' },
  { url: '/contrato/CT-01/riesgos/RG-01/editar', name: 'ct01-riesgo-editar' },
  { url: '/contrato/CT-01/subcontratos/SC-01/editar', name: 'ct01-subcontrato-editar' }
];

const ROUTES = ROUTE_DEFS.map((r) => ({
  url: r.url,
  stem: `${PREFIX}-${r.name}`
}));

console.log(`[QA PASS4] ${ROUTES.length} rutas × ${SIZES.length} viewports con prefijo ${PREFIX}...`);

const report = [];
const browser = await chromium.launch({ headless: true });

try {
  for (let idx = 0; idx < ROUTES.length; idx++) {
    const route = ROUTES[idx];
    const itemReport = { index: idx + 1, url: route.url, stem: route.stem, viewports: {} };
    console.log(`\n[${idx + 1}/${ROUTES.length}] ${route.url}`);

    for (const width of SIZES) {
      const height = width === 390 ? 844 : width === 768 ? 1024 : width === 1280 ? 800 : 900;
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 1,
        locale: 'es-CO'
      });

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
      } catch {
        // timeout de networkidle tolerado si el DOM respondió
      }

      await page.waitForTimeout(1800);

      // Chequeo DOM: overflow horizontal del documento y elementos fuera de viewport
      const domCheck = await page.evaluate(() => {
        const doc = document.documentElement;
        const overflowX = doc.scrollWidth - doc.clientWidth;
        return { overflowX };
      });

      const filePath = path.join(OUT_DIR, `${route.stem}-${width}.png`);
      await page.screenshot({ path: filePath });

      itemReport.viewports[width] = { file: filePath, consoleErrors, failedRequests, domCheck };

      if (consoleErrors.length > 0) console.warn(`  ⚠️ [${width}px] consola: ${consoleErrors[0]}`);
      if (domCheck.overflowX > 2) console.warn(`  ⚠️ [${width}px] overflow-x del documento: ${domCheck.overflowX}px`);

      await context.close();
    }

    report.push(itemReport);
  }
} finally {
  await browser.close();
}

const reportPath = path.join(LOG_DIR, `${PREFIX}-results.json`);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
console.log(`\n[QA PASS4] Completo (${report.length * SIZES.length} capturas). Resultados: ${reportPath}`);
