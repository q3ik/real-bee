import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const username = 'qa-user';

const login = async (page: Page): Promise<void> => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Guest' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByRole('button', { name: 'Start Playing' }).click();
  await expect(page.getByText('Playing as:')).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
});

test('login flow', async ({ page }) => {
  await login(page);

  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
});

test('logout flow', async ({ page }) => {
  await login(page);

  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByRole('button', { name: 'Confirm logout' }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Spelling Bee Coach' })).toBeVisible();
});
