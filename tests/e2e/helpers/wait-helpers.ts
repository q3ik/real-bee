/**
 * Comprehensive wait helpers for Playwright E2E tests.
 * Addresses timeout issues by providing robust element waiting,
 * state stability checks, and retry logic.
 * 
 * Issue #613: Fix E2E Test Timeouts
 */

import type { Page, Locator } from '@playwright/test';

/**
 * Wait for an element to be visible and stable with retry logic.
 * 
 * @param locator - Playwright locator
 * @param options - Wait options
 * @param options.timeout - Maximum wait time in ms (default: 15000)
 * @param options.retries - Number of retry attempts (default: 3)
 * @param options.state - Expected element state (default: 'visible')
 */
export async function waitForElement(
  locator: Locator,
  options: { timeout?: number; retries?: number; state?: 'attached' | 'detached' | 'visible' | 'hidden' } = {}
): Promise<void> {
  const {
    timeout = 15000,
    retries = 3,
    state = 'visible'
  } = options;

  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await locator.waitFor({ state, timeout });
      return;
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < retries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(
    `Element not found after ${retries} attempts: ${lastError?.message}`
  );
}

/**
 * Wait for page to reach stable state (network idle + DOM ready + animations).
 * 
 * @param page - Playwright page
 * @param options - Wait options
 * @param options.timeout - Maximum wait time (default: 15000)
 * @param options.waitForNetwork - Wait for network idle (default: true)
 * @param options.waitForAnimations - Wait for CSS animations (default: true)
 */
export async function waitForStableState(
  page: Page,
  options: { timeout?: number; waitForNetwork?: boolean; waitForAnimations?: boolean } = {}
): Promise<void> {
  const {
    timeout = 15000,
    waitForNetwork = true,
    waitForAnimations = true
  } = options;

  const startTime = Date.now();

  try {
    if (waitForNetwork) {
      await page.waitForLoadState('networkidle', { 
        timeout: Math.min(timeout, 10000) 
      });
    }

    const remainingTime = timeout - (Date.now() - startTime);
    
    await page.waitForLoadState('domcontentloaded', { 
      timeout: Math.max(remainingTime, 2000) 
    });

    if (waitForAnimations) {
      await page.evaluate(() => {
        return Promise.all(
          document.getAnimations().map(animation => animation.finished)
        );
      });
    }

    await page.waitForTimeout(300);
  } catch (error) {
    console.warn(`waitForStableState warning: ${(error as Error).message}`);
  }
}

/**
 * Wait for any one of multiple locators to become visible.
 * Useful when element selectors vary or fallbacks exist.
 * 
 * @param page - Playwright page
 * @param locators - Array of locators
 * @param options - Wait options
 * @param options.timeout - Maximum wait time (default: 15000)
 * @returns First visible locator
 */
export async function waitForOneOf(
  page: Page,
  locators: Locator[],
  options: { timeout?: number } = {}
): Promise<Locator> {
  const { timeout = 15000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    for (const locator of locators) {
      try {
        const isVisible = await locator.isVisible({ timeout: 500 });
        if (isVisible) {
          return locator;
        }
      } catch {
        // Continue checking other locators
      }
    }
    
    await page.waitForTimeout(200);
  }

  throw new Error(
    `None of ${locators.length} locators became visible within ${timeout}ms`
  );
}

/**
 * Retry an async operation with exponential backoff.
 * 
 * @param operation - Async function to retry
 * @param options - Retry options
 * @param options.maxRetries - Maximum retry attempts (default: 3)
 * @param options.initialDelay - Initial delay in ms (default: 1000)
 * @param options.maxDelay - Maximum delay in ms (default: 5000)
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: { maxRetries?: number; initialDelay?: number; maxDelay?: number } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 5000
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = Math.min(
          initialDelay * Math.pow(2, attempt),
          maxDelay
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Safely navigate back, handling potential context destruction.
 * 
 * @param page - Playwright page
 * @param options - Navigation options
 * @param options.timeout - Maximum wait time (default: 15000)
 */
export async function safeNavigateBack(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 15000 } = options;

  try {
    await page.goBack({ timeout, waitUntil: 'domcontentloaded' });
    
    await waitForStableState(page, { timeout: 5000 });
  } catch (error) {
    if ((error as Error).message.includes('context') || (error as Error).message.includes('Target closed')) {
      console.warn('Context destroyed during navigation, this may be expected');
    } else {
      throw error;
    }
  }
}

/**
 * Wait for text content to match a pattern.
 * 
 * @param locator - Playwright locator
 * @param pattern - Text pattern to match
 * @param options - Wait options
 * @param options.timeout - Maximum wait time (default: 15000)
 */
export async function waitForTextContent(
  locator: Locator,
  pattern: RegExp | string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 15000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const text = await locator.textContent({ timeout: 1000 });
      
      if (pattern instanceof RegExp) {
        if (text && pattern.test(text)) return;
      } else {
        if (text && text.includes(pattern)) return;
      }
    } catch {
      // Element not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  throw new Error(
    `Text content did not match pattern within ${timeout}ms: ${pattern}`
  );
}
