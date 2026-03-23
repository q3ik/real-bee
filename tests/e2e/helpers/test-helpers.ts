/**
 * Test Helper Utilities
 * Provides stable, reusable functions for E2E tests
 * 
 * Addresses: QA-185 (timeouts), QA-183 (touch targets), GitHub #603 (TTS)
 */

import type { Page, Locator } from '@playwright/test';

/**
 * Wait for application to be fully loaded and ready
 * Fix #1: Ensure application initializes before tests interact
 * 
 * @param page - The Playwright page object
 * @param options - Configuration options
 * @param options.timeout - Max wait time (default: 15000ms)
 */
export async function waitForAppReady(page: Page, options: { timeout?: number } = {}): Promise<void> {
  const { timeout = 15000 } = options;
  
  // Wait for network to be idle
  await page.waitForLoadState('networkidle', { timeout });
  
  // Wait for either game container or main element
  await page.waitForSelector('[data-testid="game-container"], main', { 
    state: 'attached',
    timeout 
  });
  
  // Small delay to allow any animations to settle
  await page.waitForTimeout(300);
}

/**
 * Safe button click with proper wait conditions
 * Fix #2 & #3: Handle overlaying elements and ensure visibility
 * 
 * @param page - The Playwright page object
 * @param selector - CSS selector string or Locator
 */
export async function safeClick(page: Page, selector: string | Locator): Promise<void> {
  const locator = typeof selector === 'string' ? page.locator(selector) : selector;
  
  // Wait for element to be visible and stable
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForLoadState('domcontentloaded');
  
  // Small delay for animations/overlays to clear
  await page.waitForTimeout(500);
  
  // Scroll into view if needed
  await locator.scrollIntoViewIfNeeded();
  
  // Click with retry
  await locator.click({ timeout: 10000 });
}

/**
 * Verify touch target size meets WCAG 2.1 AA standards
 * Fix #4: QA-183 - Minimum 44x44px (adjustable)
 * 
 * @param locator - The element locator
 * @param minSize - Minimum size in pixels (default: 44)
 */
export async function verifyTouchTargetSize(
  locator: Locator,
  minSize = 44
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  
  if (!box) {
    throw new Error(`Could not get bounding box for ${locator}`);
  }
  
  const { expect } = await import('@playwright/test');
  expect(box.width, `Width should be >= ${minSize}px`).toBeGreaterThanOrEqual(minSize);
  expect(box.height, `Height should be >= ${minSize}px`).toBeGreaterThanOrEqual(minSize);
  
  return box;
}

/**
 * Capture spoken word from TTS message with improved regex
 * Fix #6: GitHub #603 - Flexible pattern matching
 * 
 * @param spokenMessage - The TTS output message
 * @returns The extracted word
 */
export function captureSpokenWord(spokenMessage: string): string {
  if (!spokenMessage || typeof spokenMessage !== 'string') {
    throw new Error(`Invalid spoken message: ${JSON.stringify(spokenMessage)}`);
  }
  
  // Try multiple patterns for flexibility
  const patterns = [
    /Your word is[:\s]+([^.!?\n]+)/i,  // "Your word is: word" or "Your word is word"
    /word is[:\s]+([^.!?\n]+)/i,       // Fallback without "Your"
    /spell[:\s]+([^.!?\n]+)/i,         // Alternative phrasing
  ];
  
  for (const pattern of patterns) {
    const match = spokenMessage.match(pattern);
    if (match && match[1]) {
      const word = match[1].trim();
      if (word.length > 0) {
        return word;
      }
    }
  }
  
  // If no pattern matches, provide detailed error
  throw new Error(
    `Unable to capture spoken word from message.\n` +
    `Message: "${spokenMessage}"\n` +
    `Message length: ${spokenMessage.length}\n` +
    `Tried patterns: ${patterns.map(p => p.toString()).join(', ')}`
  );
}

/**
 * Wait for element with better error messages
 * 
 * @param page - The Playwright page object
 * @param selector - CSS selector string
 * @param options - Configuration options
 */
export async function waitForElement(
  page: Page,
  selector: string,
  options: { timeout?: number; state?: 'attached' | 'detached' | 'visible' | 'hidden' } = {}
): Promise<void> {
  const { timeout = 10000, state = 'visible' } = options;
  
  try {
    await page.waitForSelector(selector, { state, timeout });
  } catch (error) {
    // Provide diagnostic info
    const exists = await page.locator(selector).count();
    
    throw new Error(
      `Element "${selector}" not found in ${state} state.\n` +
      `Elements matching selector: ${exists}\n` +
      `Timeout: ${timeout}ms\n` +
      `Current URL: ${page.url()}\n` +
      `Original error: ${(error as Error).message}`
    );
  }
}

/**
 * Login helper with proper waits
 * 
 * @param page - The Playwright page object
 * @param username - Username to log in with
 */
export async function loginAndDismissWelcome(page: Page, username = 'e2e-test-user'): Promise<void> {
  await page.goto('/login');
  await waitForAppReady(page);
  
  await safeClick(page, page.getByRole('button', { name: 'Guest' }));
  await page.getByLabel('Username').fill(username);
  await safeClick(page, page.getByRole('button', { name: 'Start Playing' }));
  
  // Wait for login confirmation
  const { expect } = await import('@playwright/test');
  await expect(page.getByText('Playing as:')).toBeVisible({ timeout: 5000 });
  
  // Dismiss welcome screen if present
  const skipBtn = page.getByRole('button', { name: 'Skip' });
  const isVisible = await skipBtn.isVisible({ timeout: 2000 }).catch(() => false);
  if (isVisible) {
    await safeClick(page, skipBtn);
  }
  
  // Ensure we're on home/game page
  await waitForAppReady(page);
}

/**
 * Check for viewport overflow
 * Fix #5: Horizontal overflow on mobile
 * 
 * @param page - The Playwright page object
 */
export async function checkViewportOverflow(
  page: Page
): Promise<{ bodyWidth: number; viewportWidth: number; hasOverflow: boolean }> {
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportSize = page.viewportSize();

  if (!viewportSize) {
    throw new Error('Unable to determine viewport size — page may not be fully loaded');
  }
  
  return {
    bodyWidth,
    viewportWidth: viewportSize.width,
    hasOverflow: bodyWidth > viewportSize.width,
  };
}
