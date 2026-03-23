/**
 * Global Test Setup
 * 
 * Runs once before all tests to verify browser health and environment.
 * Prevents test execution if critical issues are detected.
 * 
 * Addresses issue #609 - Chromium SIGSEGV crashes in CI
 */

import { chromium } from '@playwright/test';

/**
 * Global setup function executed before all tests.
 * Verifies browser can launch and operate correctly.
 */
export default async function globalSetup(): Promise<void> {
  console.log('\n=== Global Test Setup ===\n');

  const isCI = !!process.env.CI;
  const isAudioTest = process.env.TEST_AUDIO === 'true';

  if (isCI) {
    console.log('[Setup] Running in CI environment');
    console.log(`[Setup] Audio test mode: ${isAudioTest}`);
  }

  // Browser health verification
  try {
    console.log('[Setup] Verifying Chromium browser health...');

    const browser = await chromium.launch({
      args: [
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--max-old-space-size=4096',
      ],
      timeout: 60000,
      handleSIGTERM: true,
      handleSIGINT: true,
    });

    console.log('[Setup] ✓ Browser launched successfully');

    // Verify context creation
    const context = await browser.newContext();
    console.log('[Setup] ✓ Browser context created');

    // Verify page creation and navigation
    const page = await context.newPage();
    console.log('[Setup] ✓ Page created');

    await page.goto('about:blank');
    console.log('[Setup] ✓ Navigation successful');

    // Verify JavaScript execution
    const result = await page.evaluate(() => {
      return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        timestamp: Date.now(),
      };
    });
    console.log('[Setup] ✓ JavaScript evaluation works');
    console.log(`[Setup]   User Agent: ${result.userAgent}`);

    // Audio-specific checks if running audio tests
    if (isAudioTest) {
      console.log('[Setup] Running audio-specific health checks...');

      const audioAvailable = await page.evaluate(() => {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        return !!AudioContextClass;
      });

      if (audioAvailable) {
        console.log('[Setup] ✓ AudioContext API available');

        // Try creating a test AudioContext
        const audioWorks = await page.evaluate(() => {
          try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return { success: false, error: 'AudioContext not available', state: '' };
            const ctx = new AudioContextClass();
            const state = ctx.state;
            ctx.close();
            return { success: true, state };
          } catch (error) {
            return { success: false, error: (error as Error).message, state: '' };
          }
        });

        if (audioWorks.success) {
          console.log(`[Setup] ✓ AudioContext initialization works (state: ${audioWorks.state})`);
        } else {
          console.warn(`[Setup] ⚠ AudioContext initialization failed: ${audioWorks.error}`);
        }
      } else {
        console.warn('[Setup] ⚠ AudioContext API not available');
      }
    }

    // Cleanup
    await page.close();
    await context.close();
    await browser.close();
    console.log('[Setup] ✓ Browser closed cleanly');

    console.log('\n[Setup] ✓ All health checks passed');
    console.log('=== Setup Complete ===\n');

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    const isMissingExecutable =
      msg.includes("Executable doesn't exist") || msg.includes('not found');

    if (isMissingExecutable) {
      console.warn('[Setup] ⚠ Chromium not available — skipping browser health check');
      console.warn('[Setup] Per-test health checks will run for the configured browser');
      return;
    }

    console.error('\n[Setup] ✗ Browser health check FAILED!');
    console.error('[Setup] Error:', msg);
    if (error instanceof Error) {
      console.error('[Setup] Stack:', error.stack);
    }

    if (isCI) {
      console.error('\n[Setup] Aborting test execution due to browser health failure in CI');
      throw error;
    }
  }
}
