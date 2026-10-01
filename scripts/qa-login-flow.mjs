// E2E del flujo de sesión de Seven Save: guard, login válido, login inválido y logout.
// Uso: node scripts/qa-login-flow.mjs [outPrefix]
import { chromium } from 'playwright';

const out = process.argv[2] || 'scratch/qa/flow';
const BASE = 'http://localhost:3000';
const browser = await chromium.launch();
const report = [];

try {
  // 1) Guard: sin sesión → /dashboard debe aterrizar en /login
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/login', { timeout: 20000 }).catch(() => {});
  report.push({ paso: 'guard-redirect', url: page.url().replace(BASE, ''), ok: page.url().includes('/login') });
  await page.screenshot({ path: `${out}-1-guard.png` });

  // 2) Login inválido → banner de error
  await page.fill('#login-email', 'nadie@empresa.co');
  await page.fill('#login-pass', 'demo1234');
  await page.click('button.login-submit');
  await page.waitForSelector('.login-banner', { timeout: 10000 });
  report.push({ paso: 'login-invalido', ok: true, banner: (await page.textContent('.login-banner')).slice(0, 80) });
  await page.screenshot({ path: `${out}-2-error.png` });

  // 3) Login válido → /dashboard
  await page.fill('#login-email', 'lmendez@empresa.co');
  await page.fill('#login-pass', 'demo1234');
  await page.click('button.login-submit');
  await page.waitForURL('**/dashboard', { timeout: 20000 });
  await page.waitForTimeout(2500);
  const brand = await page.textContent('.brand-t').catch(() => 'NO');
  report.push({ paso: 'login-valido', url: page.url().replace(BASE, ''), brand, ok: page.url().includes('/dashboard') });
  await page.screenshot({ path: `${out}-3-dashboard.png` });

  // 4) Logout desde el dropdown del header
  await page.click('.user');
  await page.waitForTimeout(400);
  const logoutBtn = page.locator('[aria-label="Cerrar sesión y volver al login"]');
  await logoutBtn.click();
  await page.waitForURL('**/login', { timeout: 15000 });
  report.push({ paso: 'logout', url: page.url().replace(BASE, ''), ok: page.url().includes('/login') });
  await page.screenshot({ path: `${out}-4-logout.png` });
  await ctx.close();

  // 5) Login móvil (390px)
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mpage = await mctx.newPage();
  await mpage.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await mpage.waitForTimeout(1500);
  await mpage.screenshot({ path: `${out}-5-mobile.png` });
  report.push({ paso: 'login-mobile', ok: true });
  await mctx.close();
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
