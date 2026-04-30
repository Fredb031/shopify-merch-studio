import { test, expect } from '@playwright/test';

test('contact form: submit generates T-XXXX ref', async ({ page }) => {
  await page.goto('/fr-ca/contact');

  await page.fill('input[name="name"]', 'Test User');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.selectOption('select[name="subject"]', 'product');
  await page.fill(
    'textarea[name="message"]',
    'Question sur les hoodies pour mon équipe de construction.',
  );

  await page.getByRole('button', { name: /Envoyer|Send/i }).click();

  // Success view shows a T-XXXX ticket reference.
  await expect(page.getByText(/T-/).first()).toBeVisible({ timeout: 5000 });
});
