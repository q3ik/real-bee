/**
 * Shared E2E test helper functions
 */

import type { Page } from '@playwright/test';
import {
  stableClick,
  waitForStable,
  waitForOverlaysToDisappear,
  disableAnimations,
  ensureStableEnvironment,
  isWebKit,
  isMobile,
} from './helpers/stability-helpers';

// Re-export stability helpers for convenience
export {
  stableClick,
  waitForStable,
  waitForOverlaysToDisappear,
  disableAnimations,
  ensureStableEnvironment,
  isWebKit,
  isMobile,
};

interface OverflowElement {
  selector: string;
  scrollWidth: number;
  offsetWidth: number;
  boundingRight: number;
  overflow: number;
}

interface OverflowInfo {
  scrollWidth: number;
  viewportWidth: number;
  hasOverflow: boolean;
  overflow: number;
  overflowElements: OverflowElement[];
}

/**
 * Dismisses the WelcomeScreen if it appears on the page.
 * This should be called after login to ensure the game is ready for interaction.
 * 
 * Updated to use stability helpers for WebKit/Mobile Safari compatibility (#614)
 * Now throws errors if dismissal fails to prevent hiding test issues.
 * 
 * @param page - The Playwright page object
 * @throws {Error} If welcome screen cannot be dismissed
 */
export async function dismissWelcomeScreen(page: Page): Promise<void> {
  // Wait for any overlays to clear first
  await waitForOverlaysToDisappear(page, { timeout: 3000 });
  
  const skipBtn = page.getByRole('button', { name: 'Skip' });
  
  // Check if skip button is visible
  const isVisible = await skipBtn.isVisible({ timeout: 3000 }).catch(() => false);
  
  if (isVisible) {
    // Use stable click for WebKit reliability - will throw on failure
    await stableClick(page, skipBtn, { timeout: 5000 });
    
    // Wait for welcome screen to fully disappear - now required
    const welcomeScreen = page.locator('[data-testid="welcome-screen"]');
    await welcomeScreen.waitFor({ state: 'hidden', timeout: 5000 });
  }
  // If not visible, welcome screen is already dismissed or doesn't exist
}

/**
 * Verify that there is no horizontal overflow on the page
 * Issue #612 - Mobile Viewport Overflow
 * 
 * This helper checks if any content exceeds the viewport width, which would
 * cause horizontal scrolling on mobile devices. It identifies overflow elements
 * and provides detailed diagnostic information.
 * 
 * @param page - The Playwright page object
 * @param options - Optional configuration
 * @param options.tolerance - Pixels of overflow to tolerate (e.g., 1-2px for sub-pixel rounding)
 *                            Common tolerances: 0 (strict), 1-2 (sub-pixel rounding)
 * @returns Overflow check result with hasOverflow, scrollWidth, viewportWidth, overflow, overflowElements
 * @throws {Error} If horizontal overflow exceeds tolerance threshold
 * 
 * @example
 * // Strict check - no overflow allowed
 * await verifyNoHorizontalOverflow(page);
 * 
 * @example
 * // Allow 2px tolerance for sub-pixel rounding
 * await verifyNoHorizontalOverflow(page, { tolerance: 2 });
 */
export async function verifyNoHorizontalOverflow(
  page: Page,
  { tolerance = 0 }: { tolerance?: number } = {}
): Promise<OverflowInfo> {
  // Wait for page to stabilize with improved error handling
  const networkIdleSuccess = await page.waitForLoadState('networkidle', { timeout: 5000 })
    .then(() => true)
    .catch((error: Error) => {
      // Log warning but don't fail - page may still be usable
      console.warn('⚠️  Network idle timeout reached (5s), proceeding with overflow check anyway');
      console.warn('   This may indicate slow network or pending requests');
      console.warn(`   Error: ${error.message}`);
      return false;
    });
  
  if (!networkIdleSuccess) {
    // Add small delay to let pending work settle
    await page.waitForTimeout(500);
  }
  
  // Get overflow information
  const overflowInfo = await page.evaluate((): OverflowInfo => {
    const body = document.body;
    const html = document.documentElement;
    
    const scrollWidth = Math.max(
      body.scrollWidth,
      html.scrollWidth,
      body.offsetWidth,
      html.offsetWidth
    );
    
    const viewportWidth = window.innerWidth;
    
    // Find elements that might be causing overflow
    const overflowElements: OverflowElement[] = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > viewportWidth || el.scrollWidth > viewportWidth) {
        const tagName = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const classes = el.className && typeof el.className === 'string' 
          ? `.${el.className.split(' ').filter(c => c).join('.')}` 
          : '';
        const testId = el.getAttribute('data-testid') 
          ? `[data-testid="${el.getAttribute('data-testid')}"]` 
          : '';
        
        overflowElements.push({
          selector: `${tagName}${id}${classes}${testId}`,
          scrollWidth: el.scrollWidth,
          offsetWidth: (el as HTMLElement).offsetWidth,
          boundingRight: rect.right,
          overflow: Math.max(rect.right - viewportWidth, el.scrollWidth - viewportWidth, 0)
        });
      }
    });
    
    return {
      scrollWidth,
      viewportWidth,
      hasOverflow: scrollWidth > viewportWidth,
      overflow: Math.max(0, scrollWidth - viewportWidth),
      overflowElements: overflowElements.sort((a, b) => b.overflow - a.overflow).slice(0, 5)
    };
  });
  
  // Check if overflow exceeds tolerance
  if (overflowInfo.hasOverflow && overflowInfo.overflow > tolerance) {
    // Log detailed information
    console.error('\n❌ Horizontal Overflow Detected:');
    console.error(`   Viewport Width: ${overflowInfo.viewportWidth}px`);
    console.error(`   Content Width: ${overflowInfo.scrollWidth}px`);
    console.error(`   Overflow Amount: ${overflowInfo.overflow}px`);
    
    if (tolerance > 0) {
      console.error(`   Tolerance: ${tolerance}px (overflow exceeds tolerance by ${overflowInfo.overflow - tolerance}px)`);
    } else {
      console.error(`   Tolerance: 0px (strict mode - no overflow allowed)`);
      console.error(`   💡 Tip: Use { tolerance: 1-2 } to allow for sub-pixel rounding`);
    }
    
    if (overflowInfo.overflowElements.length > 0) {
      console.error('\n   Top Overflow Elements:');
      overflowInfo.overflowElements.forEach((el, i) => {
        console.error(`   ${i + 1}. ${el.selector}`);
        console.error(`      Width: ${el.scrollWidth}px, Overflow: ${el.overflow}px`);
      });
    }
    console.error('');
    
    // Construct detailed error message
    const toleranceNote = tolerance > 0 
      ? ` (tolerance: ${tolerance}px, exceeded by ${overflowInfo.overflow - tolerance}px)`
      : ' (strict mode)';
    
    throw new Error(
      `Horizontal overflow detected: viewport=${overflowInfo.viewportWidth}px, ` +
      `content=${overflowInfo.scrollWidth}px, overflow=${overflowInfo.overflow}px${toleranceNote}. ` +
      `Top element: ${overflowInfo.overflowElements[0]?.selector || 'unknown'}`
    );
  }
  
  // Success - log in verbose mode
  if (overflowInfo.hasOverflow && overflowInfo.overflow <= tolerance) {
    console.log(
      `✅ Overflow within tolerance: ${overflowInfo.overflow}px <= ${tolerance}px tolerance`
    );
  }
  
  return overflowInfo;
}
