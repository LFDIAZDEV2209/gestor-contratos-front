import { chromium } from 'playwright';
import fs from 'node:fs';

const browser = await chromium.launch({ headless: true });
const results = [];
fs.mkdirSync('.playwright-mcp/qa', { recursive: true });
fs.mkdirSync('scratch/reports', { recursive: true });

const views = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'gerencia', path: '/gerencia' },
  { name: 'agenda', path: '/agenda' },
  { name: 'calendario', path: '/calendario' },
  { name: 'alertas', path: '/alertas' },
  { name: 'auditoria', path: '/auditoria' },
  { name: 'configuracion', path: '/configuracion' },
  { name: 'reportes', path: '/reportes' },
  { name: 'reporte-vista', path: '/reportes/r_general' },
];

const viewports = [1920, 1440, 1024, 390];

try {
  const context = await browser.newContext({ locale: 'es-CO' });
  await context.addInitScript(() => {
    localStorage.setItem('ss_auth_v1', '1');
  });

  const page = await context.newPage();

  for (const v of views) {
    for (const width of viewports) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const errors = [];
      const onError = (e) => errors.push(e.message);
      page.on('pageerror', onError);

      await page.goto(`http://localhost:3000${v.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await page.evaluate(() => document.fonts.ready);

      const evidence = await page.evaluate(() => {
        const headers = Array.from(document.querySelectorAll('.ws-section-h')).map((header) => {
          const rect = header.getBoundingClientRect();
          const style = getComputedStyle(header);
          const title = header.querySelector('.ws-section-t');
          const parent = header.parentElement;
          const pr = parent ? parent.getBoundingClientRect() : null;
          const isInsidePanel = parent && (parent.classList.contains('panel') || parent.closest('.panel'));

          const iconSvg = header.querySelector('.ws-section-ic svg');

          return {
            title: title ? title.textContent.trim() : '',
            hasIcon: !!iconSvg,
            tag: title ? title.tagName : '',
            color: title ? getComputedStyle(title).color : '',
            background: style.backgroundImage || style.backgroundColor,
            overflow: header.scrollWidth - header.clientWidth,
            isInsidePanel: !!isInsidePanel,
            flush: !parent || !parent.classList.contains('panel') || (
              Math.abs(rect.left - pr.left - parseFloat(getComputedStyle(parent).borderLeftWidth || 0)) < 2 &&
              Math.abs(rect.right - pr.right + parseFloat(getComputedStyle(parent).borderRightWidth || 0)) < 2 &&
              Math.abs(rect.top - pr.top - parseFloat(getComputedStyle(parent).borderTopWidth || 0)) < 2
            ),
          };
        });

        const thList = Array.from(document.querySelectorAll('.tbl th')).map((th) => {
          const bg = getComputedStyle(th).backgroundColor;
          const color = getComputedStyle(th).color;
          return { bg, color };
        });

        // Verificamos que ninguna cabecera th tenga fondo brand oscuro (azul primario rgb(6, 47, 88) o similar)
        const blueThs = thList.filter((th) => {
          const match = th.bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (match) {
            const [_, r, g, b] = match.map(Number);
            return r < 30 && g < 80 && b > 70; // azul oscuro brand
          }
          return false;
        });

        // Contenedores legacy .panel-h sin convertir
        const legacyHeaders = document.querySelectorAll('.panel-h:not(:has(.ws-section-h)) h2, .panel-h:not(:has(.ws-section-h)) h3, .panel-h:not(:has(.ws-section-h)) h4').length;

        const docOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

        return {
          headerCount: headers.length,
          headers,
          thCount: thList.length,
          blueThCount: blueThs.length,
          legacyHeaders,
          docOverflow,
        };
      });

      const pass =
        evidence.headerCount > 0 &&
        evidence.headers.every((h) => h.hasIcon && (h.color === 'rgb(255, 255, 255)' || h.color === '#ffffff') && h.overflow <= 1) &&
        evidence.blueThCount === 0 &&
        evidence.legacyHeaders === 0 &&
        evidence.docOverflow <= 1 &&
        errors.length === 0;

      const screenshotPath = `.playwright-mcp/qa/titulos-agy-${v.name}-${width}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });

      page.off('pageerror', onError);

      const record = {
        view: v.name,
        path: v.path,
        width,
        evidence,
        pass,
        errors,
        screenshot: screenshotPath,
      };
      results.push(record);

      console.log(
        `${pass ? 'PASS' : 'FAIL'} ${v.name} @ ${width}px: ` +
        `${evidence.headerCount} headers, ${evidence.legacyHeaders} legacy, blueTh: ${evidence.blueThCount}, ` +
        `overflow: ${evidence.docOverflow}px, errors: ${errors.length}`
      );
    }
  }
} finally {
  await browser.close();
}

fs.writeFileSync('scratch/reports/agy-titulos-results.json', JSON.stringify(results, null, 2));

const allPassed = results.every((r) => r.pass);
console.log(`\nResumen: ${results.filter((r) => r.pass).length}/${results.length} pruebas pasaron.`);
if (!allPassed) {
  process.exit(1);
}
