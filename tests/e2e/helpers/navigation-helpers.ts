/**
 * Navigation helpers for E2E tests
 * Addresses issue #615 - Browser back navigation reliability
 */

import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Safely navigates back using browser back button with proper state verification.
 * Waits for page load and React hydration without assuming URL must change.
 * 
 * Essential for avoiding "element not found" errors after navigation.
 * Note: URL may not change if login flow created duplicate history entries.
 * 
 * @param page - The Playwright page object
 * @param options - Configuration options
 * @param options.timeout - Maximum time to wait for navigation (default: 10000ms)
 * @param options.hydrationDelay - Extra time for React to hydrate (default: 1000ms)
 * 
 * @example
 * ```javascript
 * await page.goto('/game');
 * await page.getByRole('link', { name: 'Settings' }).click();
 * await safeNavigateBack(page); // Returns to /game safely
 * ```
 */
export async function safeNavigateBack(
  page: Page,
  options: { timeout?: number; hydrationDelay?: number } = {}
): Promise<void> {
  const {
    timeout = 10000,
    hydrationDelay = 1000,
  } = options;

  const beforeUrl = page.url();
  console.log('[Navigation] Starting back navigation from:', beforeUrl);

  try {
    // Perform navigation
    await page.goBack({ waitUntil: 'load', timeout });

    // Wait briefly to allow URL change attempt
    // Note: URL may not change if there are duplicate history entries (e.g., login flow)
    await page.waitForTimeout(200);

    const afterUrl = page.url();
    console.log('[Navigation] URL after back navigation:', afterUrl);
    
    if (afterUrl !== beforeUrl) {
      console.log('[Navigation] URL changed as expected');
    } else {
      console.log('[Navigation] URL did not change (may be duplicate history entry)');
    }

    // Wait for network to be idle
    await page.waitForLoadState('networkidle', { timeout });

    // Wait for React hydration
    await page.waitForTimeout(hydrationDelay);

    // Verify page is fully interactive
    await page.waitForFunction(
      () => document.readyState === 'complete',
      { timeout: 5000 }
    );

    // Wait for React root to have content
    await page.waitForFunction(
      () => {
        const root = document.querySelector('#root');
        return root && root.children.length > 0;
      },
      { timeout: 5000 }
    );

    console.log('[Navigation] Back navigation complete and page stable');

  } catch (error) {
    console.error('[Navigation] Back navigation failed:', (error as Error).message);
    console.error('[Navigation] Current URL:', page.url());
    throw new Error(`safeNavigateBack failed: ${(error as Error).message}`);
  }
}

/**
 * Navigates forward, then safely navigates back, verifying state preservation.
 * Useful for testing round-trip navigation.
 * 
 * @param page - The Playwright page object
 * @param navigationFn - Async function that performs forward navigation
 * @param options - Configuration options
 * 
 * @example
 * ```javascript
 * await navigateAndReturn(page, async () => {
 *   await page.getByRole('link', { name: 'Settings' }).click();
 * });
 * ```
 */
export async function navigateAndReturn(
  page: Page,
  navigationFn: () => Promise<void>,
  options: { timeout?: number; hydrationDelay?: number } = {}
): Promise<void> {
  const originalUrl = page.url();
  console.log('[Navigation] Starting navigate-and-return from:', originalUrl);

  // Navigate forward
  await navigationFn();
  await page.waitForLoadState('networkidle');
  
  const intermediateUrl = page.url();
  console.log('[Navigation] Navigated to:', intermediateUrl);

  // Navigate back
  await safeNavigateBack(page, options);

  // Verify we're back at original URL
  const finalUrl = page.url();
  console.log('[Navigation] Returned to:', finalUrl);
  
  expect(finalUrl).toBe(originalUrl);

  // Ensure page is stable
  await waitForStableState(page);
}

/**
 * Waits for the page to reach a stable state after navigation.
 * Ensures no pending navigations, animations, or network requests.
 * 
 * @param page - The Playwright page object
 * @param options - Configuration options
 * @param options.timeout - Maximum time to wait (default: 5000ms)
 */
export async function waitForStableState(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 5000 } = options;

  try {
    // Wait for no pending navigation
    await page.waitForLoadState('domcontentloaded', { timeout });
    
    // Wait for network idle
    await page.waitForLoadState('networkidle', { timeout });
    
    // Extra settling time
    await page.waitForTimeout(500);
    
    console.log('[Navigation] Page reached stable state');
  } catch (error) {
    console.warn('[Navigation] Timeout waiting for stable state:', (error as Error).message);
  }
}

/**
 * Safely evaluates JavaScript in page context with retry logic.
 * Protects against "Execution context was destroyed" errors.
 * 
 * @param page - The Playwright page object
 * @param fn - Function to evaluate
 * @param args - Arguments to pass to function
 * 
 * @example
 * ```javascript
 * const isVisible = await safeEvaluate(page, () => {
 *   return document.querySelector('.game').offsetHeight > 0;
 * });
 * ```
 */
export async function safeEvaluate<T>(
  page: Page,
  fn: (...args: unknown[]) => T,
  ...args: unknown[]
): Promise<T> {
  try {
    return await page.evaluate(fn, ...args);
  } catch (error) {
    if ((error as Error).message.includes('Execution context was destroyed')) {
      console.warn('[Navigation] Context destroyed, retrying evaluate...');
      
      // Wait for page to stabilize
      await page.waitForLoadState('domcontentloaded', { timeout: 3000 });
      await page.waitForTimeout(500);
      
      // Retry evaluation
      try {
        return await page.evaluate(fn, ...args);
      } catch (retryError) {
        console.error('[Navigation] Evaluate retry failed:', (retryError as Error).message);
        throw retryError;
      }
    }
    throw error;
  }
}

/**
 * Verifies that game elements are visible and functional after navigation.
 * Useful for checking state preservation.
 * 
 * @param page - The Playwright page object
 * @param options - Configuration options
 * @param options.timeout - Maximum time to wait for elements (default: 10000ms)
 */
export async function verifyGameStatePresent(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 10000 } = options;

  console.log('[Navigation] Verifying game state after navigation...');

  // Check for game elements
  await expect(page.getByText('Spell the word:')).toBeVisible({ timeout });
  await expect(page.getByRole('button', { name: /repeat word/i })).toBeVisible({ timeout });
  
  // Verify game controls are functional
  const input = page.getByPlaceholder(/type the spelling here/i);
  await expect(input).toBeVisible({ timeout });
  
  // Test input functionality
  await input.fill('test');
  await expect(input).toHaveValue('test');
  await input.clear();

  console.log('[Navigation] Game state verified - all elements present and functional');
}
