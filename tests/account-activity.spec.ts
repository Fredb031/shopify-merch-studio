import { test, expect } from '@playwright/test';

test('account: shows empty state when sessionStorage empty', async ({ page }) => {
  await page.goto('/fr-ca/account');
  await expect(
    page.getByText(/Aucune activité|No recent activity/i).first(),
  ).toBeVisible();
});

// FIXME (Phase 3): account page reads sessionStorage on mount; second
// page.goto issues a fresh navigation with a fresh sessionStorage. Needs
// addInitScript pattern. Tracked in Phase 3 operator queue.
test.fixme('account: shows quote card after submitting /soumission', async ({
  page,
}) => {
  // Hit the origin first so sessionStorage is scoped to the right host.
  await page.goto('/fr-ca/account');

  await page.evaluate(() => {
    sessionStorage.setItem(
      'va-last-quote',
      JSON.stringify({
        ref: 'Q-TEST123',
        submittedAt: new Date().toISOString(),
        employeeCount: 50,
        industry: 'construction',
        productIds: ['atc1015'],
        shippingMode: 'single',
      }),
    );
  });

  // Reload so the account page picks up the seeded sessionStorage entry.
  await page.goto('/fr-ca/account');
  await expect(page.getByText('Q-TEST123').first()).toBeVisible();
});
