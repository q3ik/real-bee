/**
 * Stability helpers for WebKit/Mobile Safari E2E tests
 * Addresses issue #614 - Element instability problems
 */

import type { Page, Locator } from '@playwright/test';

/**
 * Waits for an element to become stable (stop moving) before interacting with it.
 * Essential for WebKit/Mobile Safari where animations and layout shifts cause instability.
 * 
 * @param page - The Playwright page object
 * @param locator - The element to wait for
 * @param options - Configuration options
 * @param options.timeout - Maximum time to wait (default: 5000ms)
 * @param options.pollInterval - How often to check position (default: 100ms)
 * @param options.stableFor - How long position must be stable (default: 300ms)
 */
export async function waitForStable(
  page: Page,
  locator: Locator,
  options: { timeout?: number; pollInterval?: number; stableFor?: number } = {}
): Promise<void> {
  const {
    timeout = 5000,
    pollInterval = 100,
    stableFor = 300,
  } = options;

  const startTime = Date.now();
  let lastPosition: { x: number; y: number; width: number; height: number } | null = null;
  let stableStartTime: number | null = null;

  while (Date.now() - startTime < timeout) {
    try {
      // Get current bounding box
      const box = await locator.boundingBox({ timeout: 1000 });
      
      if (!box) {
        // Element not visible yet, keep waiting
        await page.waitForTimeout(pollInterval);
        continue;
      }

      const currentPosition = { x: box.x, y: box.y, width: box.width, height: box.height };

      // Check if position matches last known position
      if (lastPosition && 
          Math.abs(currentPosition.x - lastPosition.x) < 1 &&
          Math.abs(currentPosition.y - lastPosition.y) < 1 &&
          Math.abs(currentPosition.width - lastPosition.width) < 1 &&
          Math.abs(currentPosition.height - lastPosition.height) < 1) {
        
        // Position is stable
        if (!stableStartTime) {
          stableStartTime = Date.now();
        } else if (Date.now() - stableStartTime >= stableFor) {
          // Stable for required duration
          return;
        }
      } else {
        // Position changed, reset stable timer
        stableStartTime = null;
      }

      lastPosition = currentPosition;
      await page.waitForTimeout(pollInterval);

    } catch {
      // Element might be detached or not ready
      await page.waitForTimeout(pollInterval);
      lastPosition = null;
      stableStartTime = null;
    }
  }

  throw new Error(`Element did not become stable within ${timeout}ms`);
}

/**
 * Performs a stable click on an element, waiting for it to stop moving first.
 * Includes retry logic for WebKit-specific issues.
 * 
 * @param page - The Playwright page object
 * @param locator - The element to click
 * @param options - Configuration options
 * @param options.timeout - Maximum time to wait (default: 10000ms)
 * @param options.retries - Number of retry attempts (default: 3)
 */
export async function stableClick(
  page: Page,
  locator: Locator,
  options: { timeout?: number; retries?: number } = {}
): Promise<void> {
  const {
    timeout = 10000,
    retries = 3,
  } = options;

  const browserName = page.context().browser()?.browserType()?.name();
  const isWebKitBrowser = browserName === 'webkit';

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Wait for element to be visible and attached
      await locator.waitFor({ state: 'visible', timeout: timeout / retries });
      
      // Wait for element to be stable
      await waitForStable(page, locator, {
        timeout: timeout / retries,
        stableFor: isWebKitBrowser ? 500 : 300, // WebKit needs longer stability
      });

      // Scroll into view if needed
      await locator.scrollIntoViewIfNeeded({ timeout: 2000 });

      // Extra wait for WebKit after scroll
      if (isWebKitBrowser) {
        await page.waitForTimeout(200);
      }

      // Perform the click
      await locator.click({ timeout: 3000 });
      
      return; // Success!

    } catch (error) {
      if (attempt === retries - 1) {
        // Last attempt failed
        throw new Error(`stableClick failed after ${retries} attempts: ${(error as Error).message}`);
      }
      
      // Wait before retry
      await page.waitForTimeout(500);
    }
  }
}

/**
 * Waits for any overlays, modals, or blocking elements to disappear.
 * Common culprits: loading spinners, welcome screens, toast notifications, modals.
 * 
 * Updated to match actual app selectors:
 * - .modal-overlay (FeedbackModal)
 * - .fixed.inset-0 (LoadingSpinner)
 * - [data-testid="loading"] (LoadingSpinner with testid)
 * - [data-testid="welcome-screen"] (WelcomeScreen)
 * 
 * @param page - The Playwright page object
 * @param options - Configuration options
 * @param options.timeout - Maximum time to wait (default: 5000ms)
 */
export async function waitForOverlaysToDisappear(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 5000 } = options;

  const overlaySelectors = [
    '[role="dialog"]',
    '[role="alertdialog"]',
    '.modal-overlay',                    // FeedbackModal and other modals
    '.fixed.inset-0',                    // LoadingSpinner pattern
    '[data-testid="loading"]',          // LoadingSpinner with testid
    '[data-testid="welcome-screen"]',   // WelcomeScreen
  ];

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    let foundVisibleOverlay = false;

    for (const selector of overlaySelectors) {
      const elements = await page.locator(selector).all();
      
      for (const element of elements) {
        if (await element.isVisible().catch(() => false)) {
          foundVisibleOverlay = true;
          break;
        }
      }
      
      if (foundVisibleOverlay) break;
    }

    if (!foundVisibleOverlay) {
      // No overlays visible, we're good
      return;
    }

    // Wait a bit and check again
    await page.waitForTimeout(100);
  }

  // Timeout reached with overlays still present - log warning but don't fail
  console.warn('waitForOverlaysToDisappear: Some overlays still visible after timeout');
}

/**
 * Disables CSS animations and transitions for the page.
 * Critical for WebKit stability where animations cause "element not stable" errors.
 * 
 * @param page - The Playwright page object
 */
export async function disableAnimations(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `
  });
}

/**
 * Checks if the current browser is WebKit/Safari.
 * Useful for applying browser-specific workarounds.
 * 
 * @param page - The Playwright page object
 */
export function isWebKit(page: Page): boolean {
  const browserName = page.context().browser()?.browserType()?.name();
  return browserName === 'webkit';
}

/**
 * Checks if the current device is mobile (based on viewport width).
 * 
 * @param page - The Playwright page object
 */
export async function isMobile(page: Page): Promise<boolean> {
  const viewport = page.viewportSize();
  return viewport ? viewport.width < 768 : false;
}

/**
 * Combined stability check - waits for overlays and disables animations.
 * Should be called at the start of WebKit/Mobile Safari tests.
 * 
 * @param page - The Playwright page object
 */
export async function ensureStableEnvironment(page: Page): Promise<void> {
  await disableAnimations(page);
  await waitForOverlaysToDisappear(page);
  
  // Extra settling time for WebKit
  if (isWebKit(page)) {
    await page.waitForTimeout(300);
  }
}
