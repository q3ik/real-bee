import { test, expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';
import { waitForElement, waitForStableState } from './helpers/wait-helpers';

const username = 'qa-mobile-user';

/**
 * Helper: Login and dismiss welcome screen
 */
const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await waitForStableState(page, { timeout: 10000 });
  
  await page.goto('/login');
  await waitForStableState(page, { timeout: 10000 });
  
  const guestButton = page.getByRole('button', { name: 'Guest' });
  await waitForElement(guestButton, { timeout: 15000 });
  await guestButton.click();
  
  const usernameInput = page.getByLabel('Username');
  await waitForElement(usernameInput, { timeout: 15000 });
  await usernameInput.fill(username);
  
  const startButton = page.getByRole('button', { name: 'Start Playing' });
  await startButton.click();
  
  const playingAsText = page.getByText('Playing as:');
  await waitForElement(playingAsText, { timeout: 15000 });
  await expect(playingAsText).toBeVisible();

  // Dismiss the WelcomeScreen if it appears
  const skipBtn = page.getByRole('button', { name: 'Skip' });
  try {
    const isSkipVisible = await skipBtn.isVisible({ timeout: 3000 });
    if (isSkipVisible) {
      await skipBtn.click();
      await waitForStableState(page, { timeout: 5000 });
    }
  } catch {
    // Skip button not present, continue
  }
};

/**
 * Helper: Verify button meets minimum touch target size (44px)
 */
const verifyTouchTargetSize = async (locator: Locator, minSize = 44): Promise<void> => {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Could not get bounding box for element');
  expect(box.width).toBeGreaterThanOrEqual(minSize);
  expect(box.height).toBeGreaterThanOrEqual(minSize);
};

/**
 * Helper: Complete a full game round
 */
interface GameRoundResult {
  resultHeading: Locator;
  nextButton: Locator;
}

const completeGameRound = async (page: Page): Promise<GameRoundResult> => {
  // Start the game
  const startButton = page.locator('[data-testid="start-game-button"]')
    .or(page.getByRole('button', { name: 'Start Spelling Bee' }));
  await waitForElement(startButton, { timeout: 15000 });
  await expect(startButton).toBeVisible();
  await startButton.click();

  // Wait for game to load and stabilize
  await waitForStableState(page, { timeout: 15000 });
  
  const gamePrompt = page.locator('[data-testid="game-prompt"]')
    .or(page.getByText('Spell the word:'));
  await waitForElement(gamePrompt, { timeout: 15000 });
  await expect(gamePrompt).toBeVisible();

  // Input answer
  const input = page.locator('[data-testid="spelling-input"]')
    .or(page.getByPlaceholder('Type the spelling here...'));
  await waitForElement(input, { timeout: 15000 });
  await expect(input).toBeVisible();
  await input.fill('test');

  // Submit via Enter key (mobile keyboard behavior)
  await input.press('Enter');

  // Wait for result processing
  await waitForStableState(page, { timeout: 10000 });

  // Verify result appears
  const resultHeading = page.locator('[data-testid="result-heading"]')
    .or(page.getByRole('heading', { name: /Correct!|Incorrect/ }));
  await waitForElement(resultHeading, { timeout: 15000 });
  await expect(resultHeading).toBeVisible({ timeout: 15000 });

  // Verify next button is accessible
  const nextButton = page.locator('[data-testid="next-word-button"]')
    .or(page.getByRole('button', { name: 'Next Word' }));
  await waitForElement(nextButton, { timeout: 15000 });
  await expect(nextButton).toBeVisible();

  return { resultHeading, nextButton };
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
});

// ============================================
// Mobile Game Flow Tests
// These tests run on all mobile devices configured in playwright.config.js:
// - Mobile Safari (iPhone 13)
// - Mobile Chrome (Pixel 5) 
// - iPhone SE
// ============================================

test.describe('Mobile game flow', () => {
  test('complete game round on mobile', async ({ page }) => {
    await login(page);

    // Complete full game round
    const { resultHeading, nextButton } = await completeGameRound(page);

    // Verify result is displayed
    await expect(resultHeading).toBeVisible();

    // Verify touch target size for next button
    await verifyTouchTargetSize(nextButton);
  });

  test('game controls fit viewport', async ({ page }) => {
    await login(page);

    const startButton = page.locator('[data-testid="start-game-button"]')
      .or(page.getByRole('button', { name: 'Start Spelling Bee' }));
    await waitForElement(startButton, { timeout: 15000 });
    await startButton.click();
    
    await waitForStableState(page, { timeout: 15000 });
    
    const gamePrompt = page.locator('[data-testid="game-prompt"]')
      .or(page.getByText('Spell the word:'));
    await waitForElement(gamePrompt, { timeout: 15000 });
    await expect(gamePrompt).toBeVisible();

    // Verify main game container fits viewport
    const gameContainer = page.locator('[data-testid="game-container"]')
      .or(page.locator('main'));
    await waitForElement(gameContainer, { timeout: 15000 });
    await expect(gameContainer).toBeVisible();

    const box = await gameContainer.boundingBox();
    const viewportSize = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewportSize).not.toBeNull();
    if (box && viewportSize) {
      expect(box.width).toBeLessThanOrEqual(viewportSize.width);
    }
  });

  test('score display visible', async ({ page }) => {
    await login(page);

    const startButton = page.locator('[data-testid="start-game-button"]')
      .or(page.getByRole('button', { name: 'Start Spelling Bee' }));
    await waitForElement(startButton, { timeout: 15000 });
    await startButton.click();
    
    await waitForStableState(page, { timeout: 15000 });
    
    const gamePrompt = page.locator('[data-testid="game-prompt"]')
      .or(page.getByText('Spell the word:'));
    await waitForElement(gamePrompt, { timeout: 15000 });
    await expect(gamePrompt).toBeVisible();

    // Verify score/progress indicators are visible
    const scoreIndicator = page.locator('[data-testid="score-display"]')
      .or(page.getByText(/Score:|Points:|Round/));
    await waitForElement(scoreIndicator.first(), { timeout: 15000 });
    await expect(scoreIndicator.first()).toBeVisible();
  });

  test('hint button accessible if present', async ({ page }) => {
    await login(page);

    const startButton = page.locator('[data-testid="start-game-button"]')
      .or(page.getByRole('button', { name: 'Start Spelling Bee' }));
    await waitForElement(startButton, { timeout: 15000 });
    await startButton.click();
    
    await waitForStableState(page, { timeout: 15000 });
    
    const gamePrompt = page.locator('[data-testid="game-prompt"]')
      .or(page.getByText('Spell the word:'));
    await waitForElement(gamePrompt, { timeout: 15000 });
    await expect(gamePrompt).toBeVisible();

    // Look for hint/help button
    const hintButton = page.getByRole('button', { name: /Hint|Help|Show/ }).first();
    
    // If hint button exists, verify it's accessible and meets touch target size
    const hintCount = await hintButton.count();
    if (hintCount > 0) {
      await waitForElement(hintButton, { timeout: 10000 });
      await expect(hintButton).toBeVisible();
      await verifyTouchTargetSize(hintButton);
    }
  });

  test('mobile keyboard does not obscure input', async ({ page }) => {
    await login(page);

    const startButton = page.locator('[data-testid="start-game-button"]')
      .or(page.getByRole('button', { name: 'Start Spelling Bee' }));
    await waitForElement(startButton, { timeout: 15000 });
    await startButton.click();
    
    await waitForStableState(page, { timeout: 15000 });
    
    const gamePrompt = page.locator('[data-testid="game-prompt"]')
      .or(page.getByText('Spell the word:'));
    await waitForElement(gamePrompt, { timeout: 15000 });
    await expect(gamePrompt).toBeVisible();

    const input = page.locator('[data-testid="spelling-input"]')
      .or(page.getByPlaceholder('Type the spelling here...'));
    await waitForElement(input, { timeout: 15000 });
    await input.click();

    // Input should remain visible even when focused (keyboard shown)
    await expect(input).toBeVisible();
    
    // Verify input is in viewport
    const box = await input.boundingBox();
    const viewportSize = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewportSize).not.toBeNull();
    if (box && viewportSize) {
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewportSize.height);
    }
  });

  test('touch interactions work', async ({ page }) => {
    await login(page);

    // Tap to start (using click for cross-platform compatibility)
    const startButton = page.locator('[data-testid="start-game-button"]')
      .or(page.getByRole('button', { name: 'Start Spelling Bee' }));
    await waitForElement(startButton, { timeout: 15000 });
    await expect(startButton).toBeVisible();
    await verifyTouchTargetSize(startButton);
    await startButton.click();

    // Wait for game to stabilize
    await waitForStableState(page, { timeout: 15000 });
    
    // Verify game started
    const gamePrompt = page.locator('[data-testid="game-prompt"]')
      .or(page.getByText('Spell the word:'));
    await waitForElement(gamePrompt, { timeout: 15000 });
    await expect(gamePrompt).toBeVisible();

    // Fill input and tap submit button if available
    const input = page.locator('[data-testid="spelling-input"]')
      .or(page.getByPlaceholder('Type the spelling here...'));
    await waitForElement(input, { timeout: 15000 });
    await input.fill('test');

    // Look for explicit submit button
    const submitButton = page.locator('[data-testid="submit-button"]')
      .or(page.getByRole('button', { name: /Submit|Check/ })).first();
    const submitCount = await submitButton.count();
    
    if (submitCount > 0) {
      await verifyTouchTargetSize(submitButton);
      await submitButton.click();
    } else {
      // Fallback to Enter key
      await input.press('Enter');
    }

    // Wait for result processing
    await waitForStableState(page, { timeout: 10000 });

    // Verify result
    const resultHeading = page.locator('[data-testid="result-heading"]')
      .or(page.getByRole('heading', { name: /Correct!|Incorrect/ }));
    await waitForElement(resultHeading, { timeout: 15000 });
    await expect(resultHeading).toBeVisible({ timeout: 15000 });
  });

  test('all UI elements fit viewport without horizontal overflow', async ({ page }) => {
    await login(page);

    // Start game
    const startButton = page.locator('[data-testid="start-game-button"]')
      .or(page.getByRole('button', { name: 'Start Spelling Bee' }));
    await waitForElement(startButton, { timeout: 15000 });
    await startButton.click();
    
    await waitForStableState(page, { timeout: 15000 });
    
    const gamePrompt = page.locator('[data-testid="game-prompt"]')
      .or(page.getByText('Spell the word:'));
    await waitForElement(gamePrompt, { timeout: 15000 });
    await expect(gamePrompt).toBeVisible();

    // Verify no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportSize = page.viewportSize();
    expect(viewportSize).not.toBeNull();
    if (viewportSize) {
      expect(bodyWidth).toBeLessThanOrEqual(viewportSize.width);
    }

    // Verify main container fits
    const gameContainer = page.locator('[data-testid="game-container"]')
      .or(page.locator('main'));
    await waitForElement(gameContainer, { timeout: 15000 });
    await expect(gameContainer).toBeVisible();

    const box = await gameContainer.boundingBox();
    expect(box).not.toBeNull();
    if (box && viewportSize) {
      expect(box.width).toBeLessThanOrEqual(viewportSize.width);
    }
  });

  test('buttons meet minimum touch target size', async ({ page }) => {
    await login(page);

    // Verify start button
    const startButton = page.locator('[data-testid="start-game-button"]')
      .or(page.getByRole('button', { name: 'Start Spelling Bee' }));
    await waitForElement(startButton, { timeout: 15000 });
    await expect(startButton).toBeVisible();
    await verifyTouchTargetSize(startButton);

    // Start game
    await startButton.click();
    await waitForStableState(page, { timeout: 15000 });
    
    const gamePrompt = page.locator('[data-testid="game-prompt"]')
      .or(page.getByText('Spell the word:'));
    await waitForElement(gamePrompt, { timeout: 15000 });
    await expect(gamePrompt).toBeVisible();

    // Complete a round to check next button
    const input = page.locator('[data-testid="spelling-input"]')
      .or(page.getByPlaceholder('Type the spelling here...'));
    await waitForElement(input, { timeout: 15000 });
    await input.fill('test');
    await input.press('Enter');

    // Wait for result
    await waitForStableState(page, { timeout: 10000 });

    // Verify next button touch target
    const nextButton = page.locator('[data-testid="next-word-button"]')
      .or(page.getByRole('button', { name: 'Next Word' }));
    await waitForElement(nextButton, { timeout: 15000 });
    await expect(nextButton).toBeVisible({ timeout: 15000 });
    await verifyTouchTargetSize(nextButton);
  });

  test('score and progress visible on screen', async ({ page }) => {
    await login(page);

    const startButton = page.locator('[data-testid="start-game-button"]')
      .or(page.getByRole('button', { name: 'Start Spelling Bee' }));
    await waitForElement(startButton, { timeout: 15000 });
    await startButton.click();
    
    await waitForStableState(page, { timeout: 15000 });
    
    const gamePrompt = page.locator('[data-testid="game-prompt"]')
      .or(page.getByText('Spell the word:'));
    await waitForElement(gamePrompt, { timeout: 15000 });
    await expect(gamePrompt).toBeVisible();

    // Verify score/progress indicators don't overflow and remain visible
    const scoreIndicator = page.locator('[data-testid="score-display"]')
      .or(page.getByText(/Score:|Points:|Round/).first());
    await waitForElement(scoreIndicator, { timeout: 15000 });
    await expect(scoreIndicator).toBeVisible();

    const box = await scoreIndicator.boundingBox();
    const viewportSize = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewportSize).not.toBeNull();
    if (box && viewportSize) {
      expect(box.x + box.width).toBeLessThanOrEqual(viewportSize.width);
    }
  });

  test('input field remains accessible', async ({ page }) => {
    await login(page);

    const startButton = page.locator('[data-testid="start-game-button"]')
      .or(page.getByRole('button', { name: 'Start Spelling Bee' }));
    await waitForElement(startButton, { timeout: 15000 });
    await startButton.click();
    
    await waitForStableState(page, { timeout: 15000 });
    
    const gamePrompt = page.locator('[data-testid="game-prompt"]')
      .or(page.getByText('Spell the word:'));
    await waitForElement(gamePrompt, { timeout: 15000 });
    await expect(gamePrompt).toBeVisible();

    // Verify input is visible and accessible
    const input = page.locator('[data-testid="spelling-input"]')
      .or(page.getByPlaceholder('Type the spelling here...'));
    await waitForElement(input, { timeout: 15000 });
    await expect(input).toBeVisible();
    await input.click();
    
    // Input should accept text
    await input.fill('testing');
    await expect(input).toHaveValue('testing');
  });

  test('complete full game flow', async ({ page }) => {
    await login(page);

    // Start game
    const startButton = page.locator('[data-testid="start-game-button"]')
      .or(page.getByRole('button', { name: 'Start Spelling Bee' }));
    await waitForElement(startButton, { timeout: 15000 });
    await startButton.click();
    
    await waitForStableState(page, { timeout: 15000 });
    
    const gamePrompt = page.locator('[data-testid="game-prompt"]')
      .or(page.getByText('Spell the word:'));
    await waitForElement(gamePrompt, { timeout: 15000 });
    await expect(gamePrompt).toBeVisible();

    // Complete first round
    const input = page.locator('[data-testid="spelling-input"]')
      .or(page.getByPlaceholder('Type the spelling here...'));
    await waitForElement(input, { timeout: 15000 });
    await input.fill('test');
    await input.press('Enter');

    // Wait for result
    await waitForStableState(page, { timeout: 10000 });

    // Verify result
    const resultHeading = page.locator('[data-testid="result-heading"]')
      .or(page.getByRole('heading', { name: /Correct!|Incorrect/ }));
    await waitForElement(resultHeading, { timeout: 15000 });
    await expect(resultHeading).toBeVisible({ timeout: 15000 });

    // Continue to next word
    const nextButton = page.locator('[data-testid="next-word-button"]')
      .or(page.getByRole('button', { name: 'Next Word' }));
    await waitForElement(nextButton, { timeout: 15000 });
    await expect(nextButton).toBeVisible();
    await nextButton.click();

    // Wait for next round to stabilize
    await waitForStableState(page, { timeout: 15000 });

    // Verify second round starts
    await waitForElement(gamePrompt, { timeout: 15000 });
    await expect(gamePrompt).toBeVisible();
    await waitForElement(input, { timeout: 15000 });
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('');
  });
});
