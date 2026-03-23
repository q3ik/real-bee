import { test, expect } from '@playwright/test';

const TEST_USERNAME = 'welcome-test-user';

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

test.describe('Welcome Screen', () => {
  test('welcome screen shows on first visit', async ({ page }) => {
    // Login
    await page.getByRole('button', { name: 'Guest' }).click();
    await page.getByLabel('Username').fill(TEST_USERNAME);
    await page.getByRole('button', { name: /start playing/i }).click();
    await expect(page).toHaveURL(/\/$/);
    
    // Verify welcome screen is visible
    const welcomeScreen = page.getByTestId('welcome-screen');
    await expect(welcomeScreen).toBeVisible();
    
    // Verify welcome message
    await expect(welcomeScreen.getByRole('heading', { name: new RegExp(`Welcome.*${TEST_USERNAME}`, 'i') })).toBeVisible();
    
    // Verify guide sections
    await expect(welcomeScreen.getByText(/how to play/i)).toBeVisible();
    await expect(welcomeScreen.getByText(/voice input tips/i)).toBeVisible();
    await expect(welcomeScreen.getByText(/nato alphabet/i)).toBeVisible();
  });

  test('can start game from welcome screen', async ({ page }) => {
    // Login
    await page.getByRole('button', { name: 'Guest' }).click();
    await page.getByLabel('Username').fill(TEST_USERNAME);
    await page.getByRole('button', { name: /start playing/i }).click();
    await expect(page).toHaveURL(/\/$/);
    
    // Click start button on welcome screen
    const welcomeStartButton = page.getByTestId('welcome-start-btn');
    await expect(welcomeStartButton).toBeVisible();
    await welcomeStartButton.click();
    
    // Verify welcome screen is gone and game controls are visible
    await expect(page.getByTestId('welcome-screen')).not.toBeVisible();
    await expect(page.getByRole('button', { name: /repeat word/i })).toBeVisible({ timeout: 5000 });
  });

  test('can skip welcome screen', async ({ page }) => {
    // Login
    await page.getByRole('button', { name: 'Guest' }).click();
    await page.getByLabel('Username').fill(TEST_USERNAME);
    await page.getByRole('button', { name: /start playing/i }).click();
    await expect(page).toHaveURL(/\/$/);
    
    // Click skip button
    const skipButton = page.getByRole('button', { name: /skip/i });
    await expect(skipButton).toBeVisible();
    await skipButton.click();
    
    // Verify welcome screen is gone and idle screen shows
    await expect(page.getByTestId('welcome-screen')).not.toBeVisible();
    await expect(page.getByRole('button', { name: /start spelling/i })).toBeVisible();
  });

  test('welcome screen does not show on subsequent visits', async ({ page }) => {
    // First visit - see and skip welcome
    await page.getByRole('button', { name: 'Guest' }).click();
    await page.getByLabel('Username').fill(TEST_USERNAME);
    await page.getByRole('button', { name: /start playing/i }).click();
    await expect(page).toHaveURL(/\/$/);
    
    const welcomeScreen = page.getByTestId('welcome-screen');
    await expect(welcomeScreen).toBeVisible();
    await page.getByRole('button', { name: /skip/i }).click();
    await expect(welcomeScreen).not.toBeVisible();
    
    // Reload page (simulating second visit)
    await page.reload();
    
    // Verify welcome screen does not appear again
    await expect(welcomeScreen).not.toBeVisible({ timeout: 2000 });
    await expect(page.getByRole('button', { name: /start spelling/i })).toBeVisible();
  });

  test('welcome screen preference persists for user', async ({ page }) => {
    // First visit - skip welcome
    await page.getByRole('button', { name: 'Guest' }).click();
    await page.getByLabel('Username').fill(TEST_USERNAME);
    await page.getByRole('button', { name: /start playing/i }).click();
    await page.getByRole('button', { name: /skip/i }).click();
    
    // Logout
    await page.getByTestId('logout-btn').click();
    await page.getByRole('button', { name: /confirm logout/i }).click();
    await expect(page).toHaveURL(/\/login/);
    
    // Login again with same user
    await page.getByRole('button', { name: 'Guest' }).click();
    await page.getByLabel('Username').fill(TEST_USERNAME);
    await page.getByRole('button', { name: /start playing/i }).click();
    
    // Verify welcome screen does not show
    await expect(page.getByTestId('welcome-screen')).not.toBeVisible({ timeout: 2000 });
    await expect(page.getByRole('button', { name: /start spelling/i })).toBeVisible();
  });
});
