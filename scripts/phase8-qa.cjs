/* Phase 8 QA: console error sweep across routes (mobile + desktop) */
const { chromium } = require('playwright');

const ROUTES = [
  '/',
  '/products',
  '/devis',
  '/histoires-de-succes',
  '/industries',
  '/industries/construction',
  '/industries/paysagement',
  '/industries/plomberie-electricite',
  '/industries/corporate',
  '/industries/municipalites',
  '/comparer',
  '/compte-corporatif',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/returns',
  '/accessibility',
  '/cart',
  '/checkout',
  '/wishlist',
];

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1280, height: 900 },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const summary = { total: 0, errors: [], warnings: [] };

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();

    for (const route of ROUTES) {
      summary.total++;
      const errs = [];
      const warns = [];

      page.removeAllListeners('pageerror');
      page.removeAllListeners('console');
      page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        const t = m.type();
        if (t === 'error') errs.push(`console.error: ${m.text()}`);
        else if (t === 'warning') warns.push(`console.warning: ${m.text()}`);
      });

      try {
        await page.goto(`http://localhost:8080${route}`, { waitUntil: 'domcontentloaded', timeout: 12000 });
        await page.waitForTimeout(800);
      } catch (e) {
        errs.push(`nav: ${e.message}`);
      }

      if (errs.length) summary.errors.push({ vp: vp.name, route, errs });
      if (warns.length) summary.warnings.push({ vp: vp.name, route, count: warns.length, sample: warns.slice(0, 2) });
    }

    await ctx.close();
  }

  await browser.close();
  console.log(JSON.stringify(summary, null, 2));
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
