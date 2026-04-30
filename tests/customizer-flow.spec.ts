import { test, expect } from '@playwright/test';
import path from 'node:path';

// Real on-disk fixture — see tests/fixtures/README.md.
// 600x600 solid-colour PNG; the customiser's client-side file checks
// (DPI estimate, raster/vector classifier, naturalWidth/Height probe)
// need a genuine asset, not a synthetic 1x1 in-memory buffer.
const LOGO_FIXTURE = path.resolve(__dirname, 'fixtures', 'test-logo.png');

test(
  'customizer flow: PDP -> /customiser -> save -> /panier with thumbnail',
  async ({ page }) => {
    // Land on a known PDP. If the slug changes, the first PLP card click below
    // is a fallback strategy; for now we hit the canonical fixture slug.
    await page.goto('/fr-ca/produits/atc1015-tshirt-pre-retreci');

    // Pick a size (third radio in the size group).
    const sizeGroup = page
      .locator('[role="radiogroup"][aria-label*="taille" i], [role="radiogroup"][aria-label*="size" i]')
      .first();
    await sizeGroup.getByRole('radio').nth(2).click();

    // Click "Personnaliser le logo" (or its English variant).
    await page
      .getByRole('button', { name: /Personnaliser le logo|Customize logo/i })
      .first()
      .click();

    // Now on /customiser with query params carrying product + variant.
    await expect(page).toHaveURL(/\/customiser\?/);

    // Upload the real PNG fixture.
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(LOGO_FIXTURE);

    // Wait for the client-side checks (raster vs vector classification).
    await expect(page.getByText(/raster|vecteur|vector/i).first()).toBeVisible({
      timeout: 8000,
    });

    // Save & continue.
    await page
      .getByRole('button', { name: /Sauvegarder|Save|Continuer/i })
      .first()
      .click();

    // Lands on /panier with the line item carrying a "logo pending" badge.
    await expect(page).toHaveURL(/\/panier/);
    await expect(
      page.getByText(/Logo en attente|Logo pending/i).first(),
    ).toBeVisible();
  },
);
