import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function reachHomeScreen(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Guest' }).click();
  await page.getByLabel('Username').fill('qa-feed-001');
  await page.getByRole('button', { name: /start playing/i }).click();

  const skipButton = page.getByRole('button', { name: 'Skip' });
  const chooseDifficulty = page.getByText('Choose difficulty');

  // Wait for either the welcome modal's Skip button or the difficulty screen
  await expect(skipButton.or(chooseDifficulty)).toBeVisible({ timeout: 5000 });

  if (await skipButton.isVisible()) {
    await skipButton.click();
  }

  await expect(chooseDifficulty).toBeVisible();
}

test('FEED-001 opens feedback dialog', async ({ page }) => {
  await reachHomeScreen(page);

  await expect(page.getByRole('dialog', { name: 'Send Feedback or Report a Bug' })).toBeHidden();

  await page.getByRole('button', { name: 'Feedback' }).click();

  await expect(page.getByRole('dialog', { name: 'Send Feedback or Report a Bug' })).toBeVisible();
  await expect(page.getByText('Help us improve Spelling Bee Coach. Your feedback is valuable!')).toBeVisible();
});
