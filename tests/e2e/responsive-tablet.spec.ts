import { test, expect } from '@playwright/test';
import { dismissWelcomeScreen } from './helpers';

test('RESP-003: tablet 768px layout displays correctly', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Guest' }).click();
  await page.getByLabel('Username').fill('qa-user');
  await page.getByRole('button', { name: /start playing/i }).click();

  await expect(page.getByText('Playing as:')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Spelling Bee Coach' })).toBeVisible();

  // Dismiss the WelcomeScreen if it appears
  await dismissWelcomeScreen(page);

  await expect(page.getByRole('button', { name: /start spelling bee/i })).toBeVisible();

  const pageHasHorizontalOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth,
  );

  expect(pageHasHorizontalOverflow).toBeFalsy();
});
