import { test, expect } from '@playwright/test';
import { safeNavigateBack, waitForStableState, verifyGameStatePresent } from './helpers/navigation-helpers';

const username = 'edge-006-user';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
});

test('EDGE-006: browser back during an active game keeps app usable', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.getByRole('button', { name: 'Guest' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByRole('button', { name: /start playing/i }).click();

  // Dismiss welcome screen if present
  const skipBtn = page.getByRole('button', { name: 'Skip' });
  if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBtn.click();
  }

  // Start game and wait for stable state
  await page.getByRole('button', { name: /start spelling bee/i }).click();
  await waitForStableState(page);
  
  // Verify initial game state
  await expect(page.getByText('Spell the word:')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: /repeat word/i })).toBeVisible({ timeout: 10000 });

  console.log('[Test] Game started successfully, preparing for navigation');

  // Navigate back using safe helper
  await safeNavigateBack(page, {
    timeout: 15000,
    hydrationDelay: 1500, // Extra time for React to restore state
  });

  // Verify URL after back navigation
  await expect(page).toHaveURL('/');
  console.log('[Test] Successfully navigated back to home');

  // Verify game UI is still visible and functional after back navigation
  // Use longer timeouts because state restoration may take time
  await expect(page.getByText('Spell the word:')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: /repeat word/i })).toBeVisible({ timeout: 10000 });
  
  console.log('[Test] Core game elements verified after navigation');

  // Verify additional game controls are accessible
  await expect(page.getByRole('button', { name: /hint/i })).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: /definition/i })).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: /sentence/i })).toBeVisible({ timeout: 5000 });
  
  console.log('[Test] Additional controls verified');

  // Verify input field is still accessible and functional
  const input = page.getByPlaceholder(/type the spelling here/i);
  await expect(input).toBeVisible({ timeout: 5000 });
  
  // Test that input actually works
  await input.fill('test');
  await expect(input).toHaveValue('test');
  
  console.log('[Test] Input functionality verified - test passed!');
});

test('EDGE-006: game state persists through multiple navigations', async ({ page }) => {
  // Login and start game
  await page.goto('/login');
  await page.getByRole('button', { name: 'Guest' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByRole('button', { name: /start playing/i }).click();

  const skipBtn = page.getByRole('button', { name: 'Skip' });
  if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBtn.click();
  }

  await page.getByRole('button', { name: /start spelling bee/i }).click();
  await waitForStableState(page);
  
  // Verify game started
  await verifyGameStatePresent(page);

  console.log('[Test] Initial game state verified');

  // Navigate back
  await safeNavigateBack(page);
  await expect(page).toHaveURL('/');
  
  // Verify state after first back
  await verifyGameStatePresent(page);
  console.log('[Test] State preserved after first back navigation');

  // Navigate forward
  await page.goForward({ waitUntil: 'load' });
  await waitForStableState(page);
  
  // Navigate back again
  await safeNavigateBack(page);
  await expect(page).toHaveURL('/');
  
  // Verify state still present after multiple navigations
  await verifyGameStatePresent(page);
  console.log('[Test] State preserved after multiple navigations - test passed!');
});
