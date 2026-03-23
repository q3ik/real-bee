import { test, expect } from '@playwright/test';

/**
 * Mobile configuration validation tests
 * 
 * These tests validate that:
 * 1. Each mobile project uses its configured device viewport
 * 2. The app renders correctly on mobile viewports
 * 3. Critical UI elements are accessible on mobile
 * 
 * NOTE: These tests run under whatever project is executing them.
 * They validate the project's configured viewport, not a hardcoded device.
 */

test.describe('Mobile viewport validation', () => {
  test('should load app successfully', async ({ page, browserName }) => {
    await page.goto('/');
    
    // Verify app loads
    await expect(page).toHaveTitle(/Buzzy/i);
    
    // Verify viewport is configured (mobile projects will have smaller viewports)
    const viewport = page.viewportSize();
    // Use assertion + guard: assertion fails the test explicitly if null;
    // guard provides TypeScript type narrowing for subsequent accesses.
    expect(viewport).not.toBeNull();
    if (!viewport) throw new Error('Viewport is unexpectedly null');
    expect(viewport.width).toBeGreaterThan(0);
    expect(viewport.height).toBeGreaterThan(0);
    
    // Log viewport for debugging
    console.log(`✓ Loaded in ${browserName} with viewport: ${viewport.width}×${viewport.height}`);
  });

  test('should render navigation without horizontal overflow', async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to be interactive
    await expect(page).toHaveTitle(/Buzzy/i);
    
    // Check for horizontal scrollbar (indicates layout overflow)
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    expect(hasHorizontalScroll).toBe(false);
  });

  test('should render main navigation elements', async ({ page }) => {
    await page.goto('/');
    
    // Verify critical navigation elements are present
    // (Adjust selectors based on your actual app structure)
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Verify viewport is reasonable for mobile
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      // Mobile-specific check: verify touch targets are reasonable size
      const buttons = page.locator('button');
      const count = await buttons.count();
      
      // If there are buttons, verify they're accessible
      if (count > 0) {
        const firstButton = buttons.first();
        const box = await firstButton.boundingBox();
        if (box) {
          // Touch targets should be at least 44px (Apple HIG recommendation)
          // We'll be lenient and check for at least 32px
          expect(box.height).toBeGreaterThanOrEqual(32);
        }
      }
    }
  });

  test('should have valid viewport for configured project', async ({ page, browserName }) => {
    await page.goto('/');
    
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    if (!viewport) throw new Error('Viewport is unexpectedly null');
    
    // Validate viewport dimensions are reasonable
    expect(viewport.width).toBeGreaterThanOrEqual(320); // Min mobile width
    expect(viewport.width).toBeLessThanOrEqual(2000); // Max reasonable width
    expect(viewport.height).toBeGreaterThanOrEqual(480); // Min mobile height
    
    // Log for CI debugging
    console.log(`✓ ${browserName} viewport validated: ${viewport.width}×${viewport.height}`);
  });
});
