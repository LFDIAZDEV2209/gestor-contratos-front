import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const cases = [
  ['/contratos/nuevo', 'numero'], ['/empresas/nueva', 'nit'], ['/documentos/nuevo', 'contractId'],
  ['/actas/nueva', 'contractId'], ['/garantias/nueva', 'contractId'], ['/ejecucion/nueva', 'contractId'],
  ['/pagos/nuevo', 'contractId'], ['/modificaciones/nueva', 'contractId'], ['/incumplimientos/nuevo', 'contractId'],
  ['/incumplimientos/planes/nuevo', 'contractId'], ['/riesgos/nuevo', 'contractId'], ['/subcontratos/nuevo', 'contractId'],
  ['/aseguradoras/cupos/nuevo', 'numero'], ['/configuracion/usuarios/nuevo', 'nombre'],
  ['/alertas/tareas/nueva?alerta=AL-01', 'titulo'], ['/documentos/DC-01/versiones/nueva', 'archivo'],
  ...['actas', 'documentos', 'ejecucion', 'entregables', 'garantias', 'incumplimientos', 'modificaciones', 'obligaciones', 'pagos', 'planes', 'prorrogas', 'reinicios', 'riesgos', 'subcontratos', 'suspensiones'].map((resource) => [
    `/contrato/CT-01/${resource}/nueva`,
    ({ actas: 'numero', documentos: 'nombre', ejecucion: 'valor', entregables: 'nombre', garantias: 'poliza', incumplimientos: 'descripcion', modificaciones: 'numero', obligaciones: 'descripcion', pagos: 'numero', planes: 'hallazgo', prorrogas: 'justificacion', reinicios: 'justificacion', riesgos: 'riesgo', subcontratos: 'numero', suspensiones: 'justificacion' })[resource]
  ]),
  ['/contrato/CT-01/entregables/EN-01/entrega/editar', 'avance', '-1']
];
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [route, field, value = ''] of cases) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => localStorage.setItem('ss_auth_v1', '1'));
    const page = await context.newPage();
    let target = route;
    if (route.startsWith('/alertas/tareas/')) {
      await page.goto('http://localhost:3000/alertas', { waitUntil: 'networkidle' });
      target = await page.locator('a[href*="/alertas/tareas/nueva"]').first().getAttribute('href');
      assert.ok(target, 'No hay alerta para el sondeo');
    }
    await page.goto(`http://localhost:3000${target}`, { waitUntil: 'networkidle' });
    const control = page.locator(`[name="${field}"]`).first();
    await control.waitFor();
    if (!(await control.evaluate((el) => el.tagName === 'SELECT'))) await control.fill(value);
    const unnamed = await page.locator('main input, main select, main textarea').evaluateAll((controls) => controls.filter((el) => !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')).map((el) => el.outerHTML));
    assert.deepEqual(unnamed, [], `Controles sin nombre: ${route}`);
    await page.locator('.form-foot button.pri').click({ force: true });
    await page.waitForTimeout(350);
    const invalid = await page.locator('[aria-invalid="true"]').evaluateAll((controls) => controls.map((el) => ({ name: el.name, described: (el.getAttribute('aria-describedby') || '').split(/\s+/).every((id) => !!document.getElementById(id)) })));
    assert.ok(invalid.length, `No se expusieron errores: ${route}`);
    assert.ok(invalid.every((item) => item.described), `Referencia de error rota: ${route}`);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-invalid')), 'true', `Foco sin error: ${route}`);
    assert.equal(await page.locator('main h1').count(), 1, `h1: ${route}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 2, `Overflow tras validar: ${route}: ${overflow}`);
    results.push({ route, invalid, focus: await page.evaluate(() => document.activeElement?.getAttribute('name')), overflow });
    console.log(`OK ${route}`);
    await context.close();
  }
  const context = await browser.newContext();
  await context.addInitScript(() => localStorage.setItem('ss_auth_v1', '1'));
  const page = await context.newPage();
  await page.goto('http://localhost:3000/contratos/nuevo', { waitUntil: 'networkidle' });
  const tabs = page.getByRole('tab');
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('End');
  assert.equal(await tabs.last().getAttribute('aria-selected'), 'true');
  await page.keyboard.press('Home');
  assert.equal(await tabs.first().getAttribute('aria-selected'), 'true');
  await page.locator('[name="numero"]').fill('QA-FOCUS');
  await tabs.nth(1).click();
  await page.locator('[name="fechaInicio"]').fill('2026-10-10');
  await page.locator('[name="fechaFin"]').fill('2026-10-01');
  await tabs.last().click();
  await page.locator('.form-foot button.pri').click({ force: true });
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('name')), 'fechaFin');
  results.push({ tabs: 'ArrowRight/End/Home', hiddenFieldFocus: 'fechaFin' });
  await context.close();
} finally {
  fs.mkdirSync('scratch/qa', { recursive: true });
  fs.writeFileSync('scratch/qa/pass4fixcodex-a11y-probe.json', JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(`Verificados ${cases.length} formularios y pestañas.`);
