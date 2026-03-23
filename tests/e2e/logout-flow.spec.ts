import { test, expect } from '@playwright/test';

const TEST_USERNAME = 'logout-test-user';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/login');
});

test.afterEach(async ({ page }) => {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test.describe('Logout Flow', () => {
  test('complete logout workflow', async ({ page }) => {
    // Step 1: Login
    await expect(page.getByRole('heading', { name: 'Spelling Bee Coach' })).toBeVisible();
    await page.getByRole('button', { name: 'Guest' }).click();
    await page.getByLabel('Username').fill(TEST_USERNAME);
    await page.getByRole('button', { name: /start playing/i }).click();

    // Verify logged in to home page
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Playing as:')).toBeVisible();
    await expect(page.getByText(TEST_USERNAME)).toBeVisible();

    // Step 2: Click logout button
    await page.getByTestId('logout-btn').click();

    // Step 3: Confirm logout in session summary dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Session summary' })).toBeVisible();
    
    // Click "Confirm logout" button
    await page.getByRole('button', { name: /confirm logout/i }).click();

    // Step 4: Verify redirected to login page
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Spelling Bee Coach' })).toBeVisible();
    await page.getByRole('button', { name: 'Guest' }).click();
    await expect(page.getByLabel('Username')).toBeVisible();

    // Step 5: Verify session is cleared
    const hasUsername = await page.evaluate(() => {
      return localStorage.getItem('username') !== null;
    });
    expect(hasUsername).toBe(false);

    // Step 6: Verify cannot access protected routes after logout
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);

    // Should redirect back to login, not allow access to home
    await page.getByRole('button', { name: 'Guest' }).click();
    await expect(page.getByLabel('Username')).toBeVisible();
  });

  test('cancel logout keeps user on home page', async ({ page }) => {
    // Login
    await page.getByRole('button', { name: 'Guest' }).click();
    await page.getByLabel('Username').fill(TEST_USERNAME);
    await page.getByRole('button', { name: /start playing/i }).click();
    await expect(page).toHaveURL(/\/$/);

    // Click logout
    await page.getByTestId('logout-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Click "Keep playing" to cancel
    await page.getByRole('button', { name: /keep playing/i }).click();

    // Verify still on home page
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Playing as:')).toBeVisible();
    await expect(page.getByText(TEST_USERNAME)).toBeVisible();

    // Verify session still exists
    const hasUsername = await page.evaluate(() => {
      return localStorage.getItem('username') !== null;
    });
    expect(hasUsername).toBe(true);
  });
});
