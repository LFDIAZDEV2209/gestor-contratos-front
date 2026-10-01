import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};

const tabs = (arg('tabs', 'ejecucion,entregables,subcontratos,modificaciones,prorrogas,suspensiones,incumplimientos,riesgos')).split(',');
const outDir = arg('out', 'scratch/qa/ola2-exp-b');
const sizes = (arg('sizes', '1440,390')).split(',').map(Number);
const BASE = 'http://localhost:3000';

const browser = await chromium.launch();
try {
  for (const tab of tabs) {
    const url = `/contrato/CT-01?tab=${tab}`;
    for (const width of sizes) {
      const height = width === 390 ? 844 : 900;
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 1,
        locale: 'es-CO',
      });

      await context.addInitScript(() => {
        window.localStorage.setItem('ss_auth_v1', '1');
      });

      const page = await context.newPage();
      try {
        await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
      } catch {}
      await page.waitForTimeout(2000);

      // Scroll the tab content into view for the viewport capture
      await page.evaluate(() => {
        const tabEl = document.querySelector('.tab-b') || document.querySelector('.panel-h') || document.querySelector('.kpis');
        if (tabEl) {
          tabEl.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      });
      await page.waitForTimeout(500);

      const file = `${outDir}-${tab}-${width}.png`;
      const dir = path.dirname(path.resolve(file));
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      await page.screenshot({ path: file });
      await context.close();
      console.log(`Captured ${file}`);
    }
  }
} finally {
  await browser.close();
}
