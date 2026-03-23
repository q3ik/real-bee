/**
 * Unit tests for browser health utilities
 * 
 * Verifies browser health check functions work correctly.
 * Addresses issue #609 - Chromium SIGSEGV crashes in CI
 */

import type { Page, BrowserContext } from '@playwright/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  verifyBrowserHealth,
  safePageInit,
  monitorBrowserCrashes,
  waitForAudioContextReady,
  collectBrowserDiagnostics,
} from '../browser-health.js';

// Mock Playwright page object
function createMockPage(overrides = {}) {
  const defaultMock = {
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    context: vi.fn().mockReturnValue({}),
    // verifyBrowserHealth calls evaluate twice:
    //   1. check 3 – expects { ready, timestamp } to verify evaluation works
    //   2. check 4 – expects a boolean `true` for documentReady
    evaluate: vi.fn()
      .mockResolvedValueOnce({ ready: 'complete', timestamp: Date.now() })
      .mockResolvedValue(true),
    waitForFunction: vi.fn().mockResolvedValue(true),
    on: vi.fn(),
    off: vi.fn(),
    url: vi.fn().mockReturnValue('http://localhost:4173'),
    viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return { ...defaultMock, ...overrides } as unknown as Page;
}

// Mock browser context
function createMockContext(overrides = {}) {
  return {
    newPage: vi.fn().mockResolvedValue(createMockPage()),
    ...overrides,
  } as unknown as BrowserContext;
}

describe('Browser Health Utilities', () => {
  describe('verifyBrowserHealth', () => {
    it('should return healthy status when all checks pass', async () => {
      const page = createMockPage();

      const result = await verifyBrowserHealth(page, { verbose: false } as Parameters<typeof verifyBrowserHealth>[1]) as any;

      expect(result.healthy).toBe(true);
      expect(result.checks.pageResponsive).toBe(true);
      expect(result.checks.contextValid).toBe(true);
      expect(result.checks.evaluationWorks).toBe(true);
      // elapsed is measured via Date.now() diff; with synchronous mocks it can
      // be 0ms, so we assert ≥ 0 rather than > 0.
      expect(result.elapsed).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy when page not responsive', async () => {
      const page = createMockPage({
        waitForLoadState: vi.fn().mockRejectedValue(new Error('Timeout')),
      });

      const result = await verifyBrowserHealth(page) as any;

      expect(result.healthy).toBe(false);
      expect(result.checks.pageResponsive).toBe(false);
    });

    it('should return unhealthy when evaluation fails', async () => {
      const page = createMockPage({
        evaluate: vi.fn().mockRejectedValue(new Error('Evaluation failed')),
      });

      const result = await verifyBrowserHealth(page) as any;

      expect(result.healthy).toBe(false);
      expect(result.checks.evaluationWorks).toBe(false);
    });

    it('should respect custom timeout', async () => {
      const page = createMockPage();
      const timeout = 5000;

      await verifyBrowserHealth(page, { timeout } as Parameters<typeof verifyBrowserHealth>[1]);

      expect(page.waitForLoadState).toHaveBeenCalledWith(
        'domcontentloaded',
        { timeout: timeout / 4 }
      );
    });

    it('should log verbose output when requested', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const page = createMockPage();

      await verifyBrowserHealth(page, { verbose: true } as Parameters<typeof verifyBrowserHealth>[1]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[BrowserHealth]')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('safePageInit', () => {
    it('should successfully initialize page on first attempt', async () => {
      const context = createMockContext();

      const page = await safePageInit(context, { verifyHealth: false } as Parameters<typeof safePageInit>[1]);

      expect(page).toBeDefined();
      expect(context.newPage).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const context = createMockContext({
        newPage: vi.fn()
          .mockRejectedValueOnce(new Error('Failed'))
          .mockResolvedValue(createMockPage()),
      });

      const page = await safePageInit(context, { maxRetries: 2, retryDelay: 10 } as Parameters<typeof safePageInit>[1]);

      expect(page).toBeDefined();
      expect(context.newPage).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries exceeded', async () => {
      const context = createMockContext({
        newPage: vi.fn().mockRejectedValue(new Error('Failed')),
      });

      await expect(
        safePageInit(context, { maxRetries: 2, retryDelay: 10 } as Parameters<typeof safePageInit>[1])
      ).rejects.toThrow('Failed to initialize page after 2 attempts');
    });

    it('should verify health when requested', async () => {
      const mockPage = createMockPage();
      const context = createMockContext({
        newPage: vi.fn().mockResolvedValue(mockPage),
      });

      await safePageInit(context, { verifyHealth: true } as Parameters<typeof safePageInit>[1]);

      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });

  describe('monitorBrowserCrashes', () => {
    it('should register crash event listeners', () => {
      const page = createMockPage();
      const callback = vi.fn();

      monitorBrowserCrashes(page, callback);

      expect(page.on).toHaveBeenCalledWith('crash', expect.any(Function));
      expect(page.on).toHaveBeenCalledWith('pageerror', expect.any(Function));
    });

    it('should return cleanup function', () => {
      const page = createMockPage();
      const callback = vi.fn();

      const cleanup = monitorBrowserCrashes(page, callback);

      expect(typeof cleanup).toBe('function');

      cleanup();

      expect(page.off).toHaveBeenCalled();
    });
  });

  describe('waitForAudioContextReady', () => {
    it('should detect available AudioContext', async () => {
      const page = createMockPage({
        waitForFunction: vi.fn().mockResolvedValue(true),
        evaluate: vi.fn().mockResolvedValue('running'),
      });

      const result = await waitForAudioContextReady(page) as any;

      expect(result.available).toBe(true);
      expect(result.state).toBe('running');
    });

    it('should handle AudioContext not available', async () => {
      const page = createMockPage({
        waitForFunction: vi.fn().mockRejectedValue(new Error('Timeout')),
      });

      const result = await waitForAudioContextReady(page, { timeout: 100 }) as any;

      expect(result.available).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should respect custom timeout', async () => {
      const page = createMockPage();
      const timeout = 3000;

      await waitForAudioContextReady(page, { timeout });

      expect(page.waitForFunction).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout }
      );
    });
  });

  describe('collectBrowserDiagnostics', () => {
    it('should collect basic diagnostics', async () => {
      const page = createMockPage({
        evaluate: vi.fn()
          .mockResolvedValueOnce('Mozilla/5.0')
          .mockResolvedValueOnce({
            usedJSHeapSize: 1000000,
            totalJSHeapSize: 2000000,
            jsHeapSizeLimit: 4000000,
          }),
      });

      const diagnostics = await collectBrowserDiagnostics(page) as any;

      expect(diagnostics.timestamp).toBeDefined();
      expect(diagnostics.url).toBe('http://localhost:4173');
      expect(diagnostics.viewport).toEqual({ width: 1280, height: 720 });
      expect(diagnostics.userAgent).toBe('Mozilla/5.0');
      expect(diagnostics.memory).toBeDefined();
    });

    it('should handle collection errors gracefully', async () => {
      const page = createMockPage({
        evaluate: vi.fn().mockRejectedValue(new Error('Failed')),
      });

      const diagnostics = await collectBrowserDiagnostics(page) as any;

      expect(diagnostics.error).toBeDefined();
      expect(diagnostics.timestamp).toBeDefined();
    });
  });
});
