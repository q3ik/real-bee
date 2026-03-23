import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
});

test('AUTH-002: redirects to home/game page after successful login', async ({ page }) => {
  const username = 'auth-002-user';

  await page.goto('/login');
  await page.getByRole('button', { name: 'Guest' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByRole('button', { name: /start playing/i }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByText('Playing as:')).toBeVisible();
  await expect(page.getByText(username, { exact: true })).toBeVisible();
});
