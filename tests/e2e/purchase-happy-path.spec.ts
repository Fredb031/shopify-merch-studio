// Phase 8 — Purchase happy-path E2E test.
//
// Selectors use `data-*` attribute hooks wired into the source
// components: `[data-product-card]` (catalogue grid card root),
// `[data-color-swatch]` + `[data-size-button]` (PDP variant pickers),
// `[data-customizer-canvas]` (customizer canvas wrapper), and
// `[data-cart-item]` (cart drawer line items). Keep these attributes
// stable — they are the contract this E2E suite depends on.
//
// To run (Playwright + chromium are already installed in devDependencies):
//   npx playwright install chromium   # first time only
//   npx playwright test tests/e2e/purchase-happy-path.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Purchase happy path', () => {
  test('Browse → PDP → Customizer → Cart → Checkout', async ({ page }) => {
    // Track console errors across the whole journey (assertion at the end).
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // 1. Land on homepage
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();

    // 2. Open product catalog
    await page.getByRole('link', { name: /produits/i }).click();
    await expect(page).toHaveURL(/\/produits/);

    // 3. Click first product card
    await page.locator('[data-product-card]').first().click();
    await expect(page).toHaveURL(/\/produit\//);

    // 4. Choose color + size
    await page.locator('[data-color-swatch]').first().click();
    await page.locator('[data-size-button]').first().click();

    // 5. Click "Personnaliser"
    await page.getByRole('button', { name: /personnaliser/i }).click();

    // 6. Customizer loads
    await expect(page.locator('[data-customizer-canvas]')).toBeVisible({ timeout: 10000 });

    // 7. Add to cart
    await page.getByRole('button', { name: /ajouter au panier/i }).click();

    // 8. Cart drawer opens with item
    await expect(page.locator('[data-cart-item]')).toBeVisible();

    // 9. Go to checkout
    await page
      .getByRole('link', { name: /panier|caisse|checkout/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/(panier|cart|checkout)/);

    // 10. Console errors check (favicon noise excluded).
    const meaningful = errors.filter((e) => !e.includes('favicon'));
    expect(meaningful.length, `console errors: ${meaningful.join(' | ')}`).toBe(0);
  });
});
