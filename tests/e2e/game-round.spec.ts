import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const username = 'qa-user';

const login = async (page: Page): Promise<void> => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Guest' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByRole('button', { name: 'Start Playing' }).click();
  await expect(page.getByText('Playing as:')).toBeVisible();

  // Dismiss the WelcomeScreen if it appears
  const skipBtn = page.getByRole('button', { name: 'Skip' });
  if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBtn.click();
  }
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
});

test('complete a game round with manual input', async ({ page }) => {
  await login(page);

  await page.getByRole('button', { name: 'Start Spelling Bee' }).click();
  await expect(page.getByText('Spell the word:')).toBeVisible();

  const manualInput = page.getByPlaceholder('Type the spelling here...');
  await manualInput.fill('test');
  await manualInput.press('Enter');

  const resultHeading = page.getByRole('heading', { name: /Correct!|Incorrect/ });
  await expect(resultHeading).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next Word' })).toBeVisible();
});
