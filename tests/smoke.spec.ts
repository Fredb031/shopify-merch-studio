// Playwright smoke tests for Vision Affichage.
//
// Requires `npm i -D @playwright/test && npx playwright install chromium`.
// @playwright/test IS in devDependencies, but the Chromium binary is not
// bundled — run `npx playwright install chromium` locally or let the
// dedicated CI workflow (.github/workflows/smoke.yml) do it. We keep the
// browser install out of the default `npm ci` path to keep CI fast.
//
// Local usage:
//   npx vite build && npx vite preview --port 4173 &
//   npm run test:smoke
//
// Smoke is the cheapest possible "it loads" check — no network-
// dependent assertions, no strict-mode locator gotchas. Each test
// just (1) navigates to a route and (2) confirms the React tree
// rendered something AND the ErrorBoundary did not fire. Anything
// richer (product cards, cart line items, auth flows) belongs in a
// proper integration suite with seeded fixtures.

import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:4173';

const ERROR_BOUNDARY_RE = /Quelque chose s['’]est mal pass[éeè]/i;

async function smokeRoute(page: Page, path: string) {
  // domcontentloaded (not networkidle) so a slow background fetch to
  // a 3rd-party API can't time the test out — the smoke goal is "did
  // the bundle parse + first render succeed", not "is every fetch done".
  const response = await page.goto(BASE + path, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  expect(response?.ok(), `${path} returned non-2xx`).toBeTruthy();
  // Give React one tick to mount the root.
  await page.waitForLoadState('load');
  // The React tree should have rendered something into #root once
  // the JS bundle parses. We don't assert on specific text — that
  // belongs in higher-level e2e — only that the root isn't empty.
  const rootContent = await page.locator('#root').innerText().catch(() => '');
  expect(rootContent.length, `${path} produced empty #root`).toBeGreaterThan(0);
  // ErrorBoundary copy must not appear anywhere.
  await expect(page.locator(`text=${ERROR_BOUNDARY_RE.source}`)).toHaveCount(0);
}

test.describe('Vision Affichage smoke', () => {
  test('homepage renders', async ({ page }) => {
    await smokeRoute(page, '/');
  });

  test('/products renders', async ({ page }) => {
    await smokeRoute(page, '/products');
  });

  test('/cart renders', async ({ page }) => {
    await smokeRoute(page, '/cart');
  });

  test('/admin/login renders', async ({ page }) => {
    await smokeRoute(page, '/admin/login');
  });
});
