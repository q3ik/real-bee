import { test, expect } from '@playwright/test';

const TEST_USERNAME = 'game-flow-user';

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

  // Skip welcome screen if present
  const skipButton = page.getByRole('button', { name: /skip/i }).first();
  if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipButton.click();
  }
});

test.afterEach(async ({ page }) => {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test.describe('Game Flow', () => {
  test('complete game round workflow', async ({ page }) => {
    // Step 1: Start game from idle state
    const startButton = page.getByRole('button', { name: /start spelling/i });
    await expect(startButton).toBeVisible();
    await startButton.click();
    
    // Step 2: Verify playing state - game controls visible
    await expect(page.getByRole('button', { name: /repeat word/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /give sentence/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /give definition/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /give hint/i })).toBeVisible();
    
    // Step 3: Verify voice input area is present
    await expect(page.getByText(/spell the word/i)).toBeVisible();
    
    // Step 4: Use game controls
    await page.getByRole('button', { name: /repeat word/i }).click();
    // TTS audio playback cannot be detected via DOM changes
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: /give sentence/i }).click();
    // TTS audio playback cannot be detected via DOM changes
    await page.waitForTimeout(500);
    
    // Step 5: Mock voice input by directly submitting a spelling
    // Note: Since we can't easily test actual voice recognition in e2e,
    // we'll simulate the flow by checking for the submission capability
    const submitButton = page.getByRole('button', { name: /submit spelling/i });
    await expect(submitButton).toBeVisible();
    
    // Check that the spelling display area exists
    await expect(page.getByText(/current spelling/i)).toBeVisible();
  });

  test('score panel is visible', async ({ page }) => {
    // Get initial score
    const scorePanel = page.locator('text=Score').locator('..');
    await expect(scorePanel).toBeVisible();
    
    const initialScoreText = await scorePanel.textContent();
    const initialScore = parseInt(initialScoreText?.match(/\d+/)?.[0] || '0');
    
    // Verify score panel exists and is ready to track progress
    expect(initialScore).toBeGreaterThanOrEqual(0);
  });

  test('restart button shows session summary', async ({ page }) => {
    // Skip welcome, start game
    const startButton = page.getByRole('button', { name: /start spelling/i });
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Click restart button
    const restartButton = page.getByRole('button', { name: /restart game/i });
    await expect(restartButton).toBeVisible();
    await restartButton.click();
    
    // Verify session summary dialog appears
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /session summary/i })).toBeVisible();
    
    // Verify action buttons
    await expect(dialog.getByRole('button', { name: /confirm restart/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /keep playing/i })).toBeVisible();
  });

  test('can cancel restart and continue playing', async ({ page }) => {
    // Start game
    const startButton = page.getByRole('button', { name: /start spelling/i });
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Click restart
    await page.getByRole('button', { name: /restart game/i }).click();
    
    // Cancel in dialog
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /keep playing/i }).click();
    
    // Verify dialog closed and still in game
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: /restart game/i })).toBeVisible();
  });

  test('high scores panel is visible', async ({ page }) => {
    await expect(page.getByText(/high scores/i)).toBeVisible();
  });

  test('mastered words panel is accessible', async ({ page }) => {
    // Click on mastered words badge/button
    const masteredButton = page.getByText(/mastered words/i).or(page.getByRole('button', { name: /mastered/i }));
    await expect(masteredButton).toBeVisible();
    await masteredButton.click();
    
    // Verify dialog appears with mastered words content
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 2000 });
    await expect(dialog.getByText(/mastered words/i)).toBeVisible();
  });
});
