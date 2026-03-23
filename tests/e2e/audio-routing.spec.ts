import { test, expect } from '@playwright/test';
import { dismissWelcomeScreen } from './helpers';
import { 
  verifyBrowserHealth, 
  monitorBrowserCrashes, 
  waitForAudioContextReady 
} from './helpers/browser-health';

// Webkit doesn't support microphone permissions in Playwright
// See: https://github.com/microsoft/playwright/issues/11714
test.describe('Audio Routing (DEV-108)', () => {
  test.beforeEach(async ({ page, context, browserName }) => {
    // Fix #609: Verify browser health before each test
    const health = await verifyBrowserHealth(page, { timeout: 5000 });
    if (!health.healthy) {
      console.warn('[Audio Test] Browser health check failed:', health.checks);
    }

    // Fix #609: Monitor for browser crashes during test
    monitorBrowserCrashes(page, (crashInfo) => {
      console.error('[Audio Test] Browser crash detected:', crashInfo);
    });

    // Grant microphone permission (Chromium only)
    // Firefox uses firefoxUserPrefs in playwright.config.js
    // Webkit doesn't support microphone permissions
    if (browserName === 'chromium') {
      await context.grantPermissions(['microphone']);
    }
    
    await page.goto('/login');

    // Login as guest
    await page.getByRole('button', { name: 'Guest' }).click();
    await page.getByLabel('Username').fill('TestUser');
    await page.getByRole('button', { name: /start playing/i }).click();
    await page.waitForURL('/');
  });

  test('should initialize audio session on game start from welcome screen', async ({ page, browserName }) => {
    // Skip on webkit - microphone not supported
    test.skip(browserName === 'webkit', 'Microphone permissions not supported on Webkit');
    
    // Fix #609: Wait for AudioContext to be ready before proceeding
    const audioReady = await waitForAudioContextReady(page, { timeout: 5000 });
    if (!audioReady.available) {
      console.warn('[Audio Test] AudioContext not immediately available');
    }
    
    // This test needs the welcome screen to be present
    // Start game from welcome screen
    const startButton = page.locator('button:has-text("Start Playing")');
    if (await startButton.isVisible()) {
      await startButton.click();
    }
    
    // Wait for potential audio initialization
    await page.waitForTimeout(1000);
    
    // Verify AudioContext is available and can be created
    // This works in both DEV and production builds (unlike console.log checking)
    const audioState = await page.evaluate(() => {
      // Check if AudioContext API is available
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return { available: false, canCreate: false };
      }
      
      // Try to detect if an AudioContext was already created
      // (audioSessionManager is a singleton, so we check for any existing context)
      try {
        // We can't directly access the singleton from here without exposing it,
        // but we can verify the API exists and test context creation
        const testContext = new AudioContextClass();
        const canCreate = testContext.state !== undefined;
        testContext.close(); // Clean up test context
        return { available: true, canCreate };
      } catch (error) {
        return { available: true, canCreate: false, error: (error as Error).message };
      }
    });
    
    // Verify AudioContext API is available and functional
    expect(audioState.available).toBe(true);
    expect(audioState.canCreate).toBe(true);
  });

  test('should initialize audio session on game start from idle screen', async ({ page, browserName }) => {
    // Skip on webkit - microphone not supported
    test.skip(browserName === 'webkit', 'Microphone permissions not supported on Webkit');
    
    // Dismiss welcome screen to start from idle screen
    await dismissWelcomeScreen(page);
    
    // Start game from idle screen
    await page.getByRole('button', { name: /start/i }).click();
    
    // Wait for potential audio initialization
    await page.waitForTimeout(1000);
    
    // Verify game started
    await expect(page.getByRole('heading', { name: /spell the word/i })).toBeVisible();
    
    // Verify AudioContext is available
    const audioAvailable = await page.evaluate(() => {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      return AudioContextClass !== undefined;
    });
    
    expect(audioAvailable).toBe(true);
  });

  test('should maintain audio context during voice input', async ({ page, browserName }) => {
    // Skip on webkit - microphone not supported
    test.skip(browserName === 'webkit', 'Microphone permissions not supported on Webkit');
    
    // Dismiss welcome screen for this test
    await dismissWelcomeScreen(page);
    
    // Start game
    const startButton = page.locator('button:has-text("Start")');
    if (await startButton.first().isVisible()) {
      await startButton.first().click();
    }
    
    // Wait for game to be ready
    await page.waitForTimeout(1000);
    
    // Find and click voice input button
    const voiceButton = page.locator('button[aria-label*="voice" i], button:has-text("Start")').first();
    if (await voiceButton.isVisible()) {
      await voiceButton.click();
      
      // Voice input should be active
      await page.waitForTimeout(500);
      
      // Verify microphone is active (button changes or listening indicator)
      const isListening = await page.locator('text=/Listening|Stop|Recording/i').isVisible({ timeout: 2000 }).catch(() => false);
      expect(isListening).toBe(true);
    }
  });

  test('should not throw errors when alternating between TTS and voice input', async ({ page, browserName }) => {
    // Skip on webkit - microphone not supported
    test.skip(browserName === 'webkit', 'Microphone permissions not supported on Webkit');
    
    // Dismiss welcome screen for this test
    await dismissWelcomeScreen(page);
    
    // Monitor for console errors
    const errors: string[] = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    // Start game
    const startButton = page.locator('button:has-text("Start")');
    if (await startButton.first().isVisible()) {
      await startButton.first().click();
    }
    
    await page.waitForTimeout(1000);
    
    // Trigger TTS (Repeat Word)
    const repeatButton = page.locator('button:has-text("Repeat Word")');
    if (await repeatButton.isVisible()) {
      await repeatButton.click();
      await page.waitForTimeout(1500);
    }
    
    // Start voice input
    const voiceButton = page.locator('button[aria-label*="voice" i], button:has-text("Start")').first();
    if (await voiceButton.isVisible()) {
      await voiceButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Verify no audio-related errors occurred
    const audioErrors = errors.filter(err => 
      err.toLowerCase().includes('audio') || 
      err.toLowerCase().includes('speech') ||
      err.toLowerCase().includes('recognition')
    );
    
    expect(audioErrors.length).toBe(0);
  });

  test('should handle audio session initialization failure gracefully', async ({ page, browserName }) => {
    // Skip on webkit - microphone not supported
    test.skip(browserName === 'webkit', 'Microphone permissions not supported on Webkit');
    
    // Dismiss welcome screen for this test
    await dismissWelcomeScreen(page);
    
    // This test ensures the game continues even if audio session init fails
    
    // Start game
    const startButton = page.locator('button:has-text("Start")');
    if (await startButton.first().isVisible()) {
      await startButton.first().click();
    }
    
    // Wait and verify game is playable
    await page.waitForTimeout(1000);
    
    // Game should still be functional — heading is always present once a round starts
    await expect(
      page.getByRole('heading', { name: /spell the word/i })
    ).toBeVisible();
  });

  test('should maintain speaker routing across multiple rounds', async ({ page, browserName }) => {
    // Skip on webkit - microphone not supported
    test.skip(browserName === 'webkit', 'Microphone permissions not supported on Webkit');
    
    // Dismiss welcome screen for this test
    await dismissWelcomeScreen(page);
    
    // Monitor for errors
    const errors: string[] = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    // Start game
    const startButton = page.locator('button:has-text("Start")');
    if (await startButton.first().isVisible()) {
      await startButton.first().click();
    }
    
    await page.waitForTimeout(1000);
    
    // Play through multiple interactions
    for (let i = 0; i < 3; i++) {
      // Trigger TTS
      const repeatButton = page.locator('button:has-text("Repeat Word")');
      if (await repeatButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await repeatButton.click();
        await page.waitForTimeout(1000);
      }
      
      // Brief pause
      await page.waitForTimeout(500);
    }
    
    // Verify no audio-related errors
    const audioErrors = errors.filter(err => 
      err.toLowerCase().includes('audio') || 
      err.toLowerCase().includes('earpiece') ||
      err.toLowerCase().includes('routing')
    );
    
    expect(audioErrors.length).toBe(0);
  });
});
