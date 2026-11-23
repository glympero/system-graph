import { expect, test } from '@playwright/test';

test('ask what breaks if the orders table changes, then follow a finding to its evidence', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('img', { name: /Services lens: \d+ nodes/ })).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();

  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Search questions' }).fill('breaks');
  await page.keyboard.press('Enter');
  await page.getByRole('combobox', { name: 'Node', exact: true }).fill('table:orders.orders');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();

  const answer = page.getByRole('region', { name: /What breaks if orders.orders changes/ });
  await expect(answer.getByText('6 services within 2 steps.')).toBeVisible();
  await expect(answer.getByRole('button', { name: 'payments-service' })).toBeVisible();
  await expect(page).toHaveURL(/q=impact/);

  await page.getByRole('button', { name: /R3 orders.orders is written by/ }).click();
  const link = page.getByRole('link', { name: /OrderStatusWriter.java:18/ });
  await expect(link).toHaveAttribute('href', /payments-service\/src\/main\/java\/com\/inkwell\/payments\/OrderStatusWriter.java#L18$/);
});

test('a shared link restores the same view', async ({ page }) => {
  await page.goto('./#lens=impact&focus=table%3Ainventory.stock&depth=1');
  await expect(page.getByText('Impact of')).toBeVisible();
  await expect(page.getByRole('img', { name: /Impact lens: 2 nodes/ })).toBeVisible();
  await expect(page.getByRole('region', { name: /Table inventory.stock/ })).toBeVisible();
});
