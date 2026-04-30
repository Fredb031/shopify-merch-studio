import { test, expect } from '@playwright/test';

test('kit order: select Starter kit + submit form generates K-XXXX', async ({
  page,
}) => {
  await page.goto('/fr-ca/kit');

  // Select the Starter card. Either the explicit French label or any button
  // bearing "Starter" should reveal the form.
  await page
    .getByRole('button', { name: /Choisir le kit Starter|Starter/i })
    .first()
    .click();

  // Form fields appear inline below the chosen kit.
  await page.fill('input[name="name"]', 'Test User');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="phone"]', '5145551234');
  await page.fill('input[name="company"]', 'Test Co');
  await page.fill('input[name="addressLine1"]', '123 rue Test');
  await page.fill('input[name="city"]', 'Montréal');
  await page.fill('input[name="postalCode"]', 'H2X1Y4');

  await page
    .getByRole('button', { name: /Commander mon kit|Order my kit/i })
    .click();

  // Success view shows a K-XXXX reference.
  await expect(page.getByText(/K-/).first()).toBeVisible({ timeout: 5000 });
});
