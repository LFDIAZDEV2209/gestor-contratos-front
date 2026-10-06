import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const rootRoutes = ['pagos', 'incumplimientos', 'ejecucion', 'contratos', 'aseguradoras', 'empresas', 'garantias', 'documentos', 'obligaciones', 'actas', 'modificaciones', 'riesgos', 'subcontratos', 'alertas', 'auditoria', 'agenda'];
const tabRoutes = ['pagos', 'modificaciones', 'riesgos', 'incumplimientos', 'subcontratos'].map(tab => ({ name: `expediente-${tab}`, url: `/contrato/CT-01?tab=${tab}`, expectedTables: tab === 'incumplimientos' ? 2 : 1 }));
const tabsOnly = process.argv.includes('--tabs-only');
const d06 = process.argv.includes('--d06');
const routes = d06
  ? [...rootRoutes.filter(name => name !== 'alertas').map(name => ({ name, url: `/${name}`, expectedTables: undefined })), tabRoutes.find(route => route.name === 'expediente-riesgos')]
  : [...(tabsOnly ? [] : rootRoutes.map(name => ({ name, url: `/${name}`, expectedTables: undefined }))), ...tabRoutes];
const reportFile = `scratch/reports/codex-dt${d06 ? '-d06' : tabsOnly ? '-pulido' : ''}-results.json`;
const widths = [1920, 1440, 1366, 1024];
const output = path.resolve('.playwright-mcp/qa');
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync('scratch/reports', { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  const context = await browser.newContext({ locale: 'es-CO' });
  await context.addInitScript(() => localStorage.setItem('ss_auth_v1', '1'));
  const page = await context.newPage();
  for (const { name: route, url, expectedTables } of routes) {
    const checkReadability = d06 && ['empresas', 'expediente-riesgos'].includes(route);
    for (const width of checkReadability ? [...widths, 390] : widths) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const errors = [];
      const onError = error => errors.push(error.message);
      page.on('pageerror', onError);
      await page.goto(`http://localhost:3000${url}`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.locator('main').waitFor();
      await page.evaluate(() => document.fonts.ready);
      const tables = await page.locator('table.tbl').evaluateAll(elements => elements.map(table => {
        const viewport = table.closest('.tbl-wrap');
        const headers = Array.from(table.querySelectorAll('thead th'));
        const firstRow = Array.from(table.querySelectorAll('tbody tr')).find(row => !row.querySelector('[colspan]'));
        const cells = firstRow ? Array.from(firstRow.cells) : [];
        return {
          label: table.getAttribute('aria-label') || headers.map(th => th.textContent.trim()).join(' / '),
          optimized: table.classList.contains('tbl-responsive'),
          clientWidth: viewport?.clientWidth ?? table.clientWidth,
          scrollWidth: viewport?.scrollWidth ?? table.scrollWidth,
          tableWidth: table.clientWidth,
          tableScrollWidth: table.scrollWidth,
          rows: table.querySelectorAll('tbody tr').length,
          hiddenAligned: !cells.length || headers.every((th, i) => !cells[i] || (getComputedStyle(th).display === 'none') === (getComputedStyle(cells[i]).display === 'none')),
        };
      }));
      let readability = null;
      if (checkReadability) {
        readability = await page.locator('table.tbl').first().evaluate(table => {
          const headers = Array.from(table.querySelectorAll('thead th'));
          const index = headers.findIndex(th => /razón social|evento de riesgo/i.test(th.textContent));
          const cells = Array.from(table.querySelectorAll('tbody tr')).map(row => row.cells[index]).filter(Boolean);
          const splitWords = [];
          for (const cell of cells) {
            const walker = document.createTreeWalker(cell.firstElementChild || cell, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              const node = walker.currentNode;
              for (const match of node.textContent.matchAll(/\p{L}+/gu)) {
                const range = document.createRange();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match[0].length);
                if (new Set(Array.from(range.getClientRects()).map(rect => Math.round(rect.top))).size > 1) splitWords.push(match[0]);
              }
            }
          }
          const viewport = table.closest('.tbl-wrap');
          const content = document.querySelector('.content');
          return {
            column: headers[index]?.textContent.trim(),
            minCellWidth: Math.min(...cells.map(cell => cell.getBoundingClientRect().width)),
            splitWords,
            documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            contentOverflow: content ? content.scrollWidth - content.clientWidth : 0,
            hintVisible: getComputedStyle(viewport, '::before').display !== 'none',
            overflowX: getComputedStyle(viewport).overflowX,
          };
        });
        if (width === 390) {
          const viewport = page.locator('.tbl-wrap:has(table.tbl)').first();
          await viewport.evaluate(el => { el.scrollLeft = el.scrollWidth; });
          await page.waitForFunction(() => document.querySelector('.tbl-wrap:has(table.tbl)')?.getAttribute('data-scrolled-end') === 'true');
          readability.scrollEndReached = true;
          await viewport.evaluate(el => { el.scrollLeft = 0; });
        }
      }
      const disclosures = [];
      const renderedTables = page.locator('table.tbl');
      for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
        const detail = renderedTables.nth(tableIndex).getByRole('button', { name: /^Detalle de la fila/ }).first();
        if (!await detail.count()) continue;
        const expectedFields = await renderedTables.nth(tableIndex).locator('thead th').evaluateAll(headers => headers.filter(th => th.textContent.trim() !== 'Acciones').length);
        await detail.click();
        const dialog = page.getByRole('dialog', { name: /^Detalle de la fila/ });
        await dialog.waitFor();
        const fields = await dialog.locator('dt').count();
        await page.keyboard.press('Escape');
        const escapeClosed = await dialog.count() === 0;
        const focusRestored = await detail.evaluate(el => el === document.activeElement);
        await detail.click();
        await dialog.waitFor();
        await page.locator('h1').first().click();
        const outsideClosed = await dialog.count() === 0;
        disclosures.push({ tableIndex, fields, expectedFields, escapeClosed, focusRestored, outsideClosed });
      }
      let actionMenu = null;
      const more = page.getByRole('button', { name: 'Más acciones de la fila', exact: true }).first();
      if (await more.count()) {
        await more.click();
        const menu = page.getByRole('dialog', { name: 'Más acciones de la fila', exact: true });
        await menu.waitFor();
        const secondaryActions = await menu.locator(':scope > a, :scope > button').count();
        await page.keyboard.press('Escape');
        actionMenu = { secondaryActions, escapeClosed: await menu.count() === 0, focusRestored: await more.evaluate(el => el === document.activeElement) };
      }
      const viewports = page.locator('.tbl-wrap:has(table.tbl)');
      const count = await viewports.count();
      for (let i = 0; i < count; i++) {
        await viewports.nth(i).evaluate(el => { el.scrollLeft = 0; });
        await viewports.nth(i).screenshot({ path: path.join(output, `dt-${d06 ? 'd06-' : ''}${route}-${width}${i ? `-tabla-${i + 1}` : ''}.png`) });
      }
      if (!count) await page.screenshot({ path: path.join(output, `dt-${route}-${width}.png`), fullPage: true });
      page.off('pageerror', onError);
      const mobileContainedScroll = checkReadability && width === 390;
      const pass = (tables.length > 0 || route === 'alertas') && (expectedTables === undefined || tables.length === expectedTables && disclosures.length === expectedTables) && tables.every(t => t.optimized && (mobileContainedScroll || t.scrollWidth <= t.clientWidth) && t.tableScrollWidth <= t.tableWidth && t.hiddenAligned) && errors.length === 0 && disclosures.every(d => d.fields === d.expectedFields && d.escapeClosed && d.focusRestored && d.outsideClosed) && (!actionMenu || actionMenu.secondaryActions >= 2 && actionMenu.escapeClosed && actionMenu.focusRestored) && (!readability || readability.splitWords.length === 0 && readability.documentOverflow <= 0 && readability.contentOverflow <= 0 && (!mobileContainedScroll || readability.minCellWidth >= 180 && readability.hintVisible && readability.overflowX === 'auto' && readability.scrollEndReached));
      results.push({ route, url, width, tables, readability, disclosures, actionMenu, errors, pass });
      fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
      console.log(`${pass ? 'PASS' : 'FAIL'} ${route} ${width}: ${tables.map(t => `${t.scrollWidth}/${t.clientWidth} (table ${t.tableScrollWidth}/${t.tableWidth})`).join(', ') || 'sin tabla (vista de tarjetas)'}${errors.length ? ' ERRORS ' + errors.join('; ') : ''}`);
    }
  }
} finally { await browser.close(); }
fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
const failed = results.filter(r => !r.pass);
console.log(`${results.length - failed.length}/${results.length} verificaciones correctas`);
if (failed.length) process.exitCode = 1;
