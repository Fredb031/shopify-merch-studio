import { test, expect } from '@playwright/test';

test('account: shows empty state when sessionStorage empty', async ({ page }) => {
  await page.goto('/fr-ca/account');
  await expect(
    page.getByText(/Aucune activité|No recent activity/i).first(),
  ).toBeVisible();
});

test('account: shows quote card after submitting /soumission', async ({
  page,
  context,
}) => {
  // The account page reads sessionStorage on mount; sessionStorage is scoped
  // per-tab and per-navigation in some Chromium quirks, so seed via
  // addInitScript before any navigation. Shape must match StoredQuote
  // (quoteId, createdAt, scope, products, logo, shipping, contact).
  const seeded = {
    quoteId: 'Q-TEST123',
    createdAt: new Date().toISOString(),
    scope: {
      employeeCount: 50,
      neededBy: '2099-01-01',
      industry: 'construction',
    },
    products: { productIds: ['atc1015'] },
    logo: { logoMode: 'pending', logoDescription: 'tbd' },
    shipping: {
      shippingMode: 'single',
      addressLine1: '123 rue Test',
      city: 'Montréal',
      province: 'QC',
      postalCode: 'H2X1Y4',
      country: 'CA',
    },
    contact: {
      name: 'Test User',
      email: 'test@example.com',
      phone: '5145551234',
      company: 'Test Co',
      language: 'fr',
      transactionalConsent: true,
      marketingConsent: false,
    },
  };

  await context.addInitScript((entry) => {
    try {
      window.sessionStorage.setItem('va-last-quote', JSON.stringify(entry));
    } catch {
      // sessionStorage unavailable; ignore
    }
  }, seeded);

  await page.goto('/fr-ca/account');
  await expect(page.getByText('Q-TEST123').first()).toBeVisible();
});
