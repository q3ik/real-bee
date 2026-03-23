import { test, expect, type Page } from '@playwright/test';

test('login and home screen render with filters', async ({ page }: { page: Page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Spelling Bee Coach' })).toBeVisible();
  await page.getByRole('button', { name: 'Guest' }).click();
  await page.getByLabel('Username').fill('playwright-user');
  await page.getByRole('button', { name: /start playing/i }).click();

  // Dismiss the WelcomeScreen that appears for new users
  const skipBtn = page.getByRole('button', { name: 'Skip' });
  if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBtn.click();
  }

  await expect(page.getByText('Choose difficulty')).toBeVisible();
  await expect(page.getByText('Choose grade level')).toBeVisible();
  await expect(page.getByRole('button', { name: /start spelling bee/i })).toBeVisible();
});
