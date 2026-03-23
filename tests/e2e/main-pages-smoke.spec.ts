import { test, expect } from '@playwright/test';

const TEST_USERNAME = 'smoke-user';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/login');
});

test('main pages smoke flow', async ({ page }) => {
  // Login flow
  await expect(page.getByRole('heading', { name: 'Spelling Bee Coach' })).toBeVisible();
  await page.getByRole('button', { name: 'Guest' }).click();
  await page.getByLabel('Username').fill(TEST_USERNAME);
  await page.getByRole('button', { name: /start playing/i }).click();

  // Verify home page loaded
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Playing as:')).toBeVisible();

  // Test settings dialog using data-testid
  await page.getByTestId('settings-btn').click();
  await expect(page.getByRole('dialog', { name: 'Game Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Close settings dialog' }).click();

  // Test sound toggle using data-testid
  const soundToggle = page.getByTestId('sound-toggle');
  await soundToggle.click();

  // Test feedback dialog using data-testid
  await page.getByTestId('feedback-btn').click();
  await expect(page.getByRole('dialog', { name: 'Send Feedback or Report a Bug' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  // Test difficulty selection using data-testid
  await page.getByTestId('difficulty-selector').click();
  await page.getByRole('menuitem', { name: 'Hard' }).click();

  // Test grade level selection using data-testid
  await page.getByTestId('grade-level-selector').click();
  await page.getByRole('menuitem', { name: '3-5' }).click();

  // Handle welcome dialog if present - improved with data-testid
  const welcomeStart = page.getByTestId('welcome-start-btn');
  const isWelcomeVisible = await welcomeStart.isVisible().catch(() => false);
  if (isWelcomeVisible) {
    await welcomeStart.click();
  }

  // Verify main heading still visible after interactions
  await expect(page.getByRole('heading', { name: 'Spelling Bee Coach' })).toBeVisible();

  // Test admin page access
  await page.goto('/admin/feedback');
  await expect(page.getByRole('heading', { name: 'Admin Access' })).toBeVisible();
  await expect(page.getByLabel('Admin access code')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});
