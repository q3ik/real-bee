import { test, expect } from '@playwright/test';

const TEST_USERNAME = 'ui-test-user';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Guest' }).click();
  await page.getByLabel('Username').fill(TEST_USERNAME);
  await page.getByRole('button', { name: /start playing/i }).click();
  await expect(page).toHaveURL(/\/$/);
});

test.afterEach(async ({ page }) => {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test.describe('Home UI Interactions', () => {
  test('sound toggle button works', async ({ page }) => {
    const soundToggle = page.getByTestId('sound-toggle');
    
    // Initial state should be "Sound On"
    await expect(soundToggle).toContainText('Sound On');
    
    // Click to toggle off
    await soundToggle.click();
    await expect(soundToggle).toContainText('Sound Off');
    
    // Click to toggle back on
    await soundToggle.click();
    await expect(soundToggle).toContainText('Sound On');
  });

  test('settings button opens dialog', async ({ page }) => {
    await page.getByTestId('settings-btn').click();
    
    // Verify dialog is visible
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /settings/i })).toBeVisible();
    
    // Verify settings content
    await expect(dialog.getByText(/difficulty/i)).toBeVisible();
    await expect(dialog.getByText(/grade level/i)).toBeVisible();
    await expect(dialog.getByText(/auto-submit/i)).toBeVisible();
    
    // Close dialog
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('feedback button opens feedback dialog', async ({ page }) => {
    await page.getByTestId('feedback-btn').click();
    
    // Verify dialog is visible
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /send feedback or report a bug/i })).toBeVisible();
    
    // Verify feedback/bug type buttons
    await expect(dialog.getByTestId('feedback-type-feedback')).toBeVisible();
    await expect(dialog.getByTestId('feedback-type-bug')).toBeVisible();
    
    // Close dialog
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('can submit feedback', async ({ page }) => {
    await page.getByTestId('feedback-btn').click();
    
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    
    // Fill feedback form
    await dialog.getByRole('textbox', { name: /your feedback/i }).fill('This is a test feedback message');
    await dialog.getByTestId('feedback-email').fill('test@example.com');
    
    // Submit
    await dialog.getByRole('button', { name: /submit feedback/i }).click();
    
    // Verify success message appears
    await expect(dialog.getByText(/thank you/i)).toBeVisible({ timeout: 3000 });
  });

  test('can submit bug report with diagnostics', async ({ page }) => {
    await page.getByTestId('feedback-btn').click();
    
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    
    // Switch to bug report
    await dialog.getByTestId('feedback-type-bug').click();
    
    // Verify diagnostics checkbox is checked by default
    const diagnosticsCheckbox = dialog.getByRole('checkbox', { name: /include diagnostic data/i });
    await expect(diagnosticsCheckbox).toBeChecked();
    
    // Fill bug report form
    await dialog.getByRole('textbox', { name: /describe the bug/i }).fill('Test bug report with diagnostics');
    
    // Submit
    await dialog.getByRole('button', { name: /submit bug report/i }).click();
    
    // Verify success
    await expect(dialog.getByText(/thank you/i)).toBeVisible({ timeout: 3000 });
  });

  test('user badge shows correct username', async ({ page }) => {
    await expect(page.getByText('Playing as:')).toBeVisible();
    await expect(page.getByText(TEST_USERNAME)).toBeVisible();
  });

  test('difficulty and grade badges are visible', async ({ page }) => {
    await expect(page.getByTestId('difficulty-selector')).toBeVisible();
    await expect(page.getByTestId('grade-level-selector')).toBeVisible();
  });
});
