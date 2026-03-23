/**
 * Browser Health Check Utilities
 * 
 * Provides browser stability verification and health monitoring
 * to prevent SIGSEGV crashes during test execution.
 * 
 * Addresses issue #609 - Chromium SIGSEGV crashes in CI
 */

import type { Page, BrowserContext } from '@playwright/test';

interface HealthChecks {
  pageResponsive: boolean;
  contextValid: boolean;
  evaluationWorks: boolean;
  documentReady: boolean;
}

interface HealthResult {
  healthy: boolean;
  checks: HealthChecks;
  elapsed: number;
  error?: string;
}

interface CrashInfo {
  timestamp: string;
  message: string;
  stack?: string;
  type: string;
}

interface AudioContextResult {
  available: boolean;
  state?: string;
  error?: string;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface DiagnosticsResult {
  timestamp: string;
  url: string;
  viewport: { width: number; height: number } | null;
  userAgent: string | null;
  memory: MemoryInfo | null;
  console: Array<{ type: string; text: string; timestamp: string }>;
  error?: string;
}

/**
 * Verifies browser is healthy and responsive before test execution.
 * Essential for preventing SIGSEGV crashes in CI environments.
 * 
 * @param page - The Playwright page object
 * @param options - Configuration options
 * @param options.timeout - Maximum time to wait for health check (default: 10000ms)
 * @param options.verbose - Enable verbose logging (default: false)
 * 
 * @example
 * ```javascript
 * const health = await verifyBrowserHealth(page);
 * if (!health.healthy) {
 *   console.error('Browser unhealthy:', health.checks);
 * }
 * ```
 */
export async function verifyBrowserHealth(
  page: Page,
  options: { timeout?: number; verbose?: boolean } = {}
): Promise<HealthResult> {
  const {
    timeout = 10000,
    verbose = false,
  } = options;

  const checks: HealthChecks = {
    pageResponsive: false,
    contextValid: false,
    evaluationWorks: false,
    documentReady: false,
  };

  const startTime = Date.now();

  try {
    if (verbose) console.log('[BrowserHealth] Starting health check...');

    // Check 1: Page is responsive
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: timeout / 4 });
      checks.pageResponsive = true;
      if (verbose) console.log('[BrowserHealth] ✓ Page responsive');
    } catch (error) {
      console.warn('[BrowserHealth] ✗ Page not responsive:', (error as Error).message);
    }

    // Check 2: Context is valid
    try {
      const context = page.context();
      if (context) {
        checks.contextValid = true;
        if (verbose) console.log('[BrowserHealth] ✓ Context valid');
      }
    } catch (error) {
      console.warn('[BrowserHealth] ✗ Context invalid:', (error as Error).message);
    }

    // Check 3: JavaScript evaluation works
    try {
      const result = await page.evaluate(() => {
        return { 
          ready: document.readyState,
          timestamp: Date.now(),
        };
      });
      
      if (result && result.timestamp) {
        checks.evaluationWorks = true;
        if (verbose) console.log('[BrowserHealth] ✓ Evaluation works');
      }
    } catch (error) {
      console.warn('[BrowserHealth] ✗ Evaluation failed:', (error as Error).message);
    }

    // Check 4: Document is ready
    try {
      const ready = await page.evaluate(() => document.readyState === 'complete');
      checks.documentReady = ready;
      if (verbose && ready) console.log('[BrowserHealth] ✓ Document ready');
    } catch (error) {
      console.warn('[BrowserHealth] ✗ Document not ready:', (error as Error).message);
    }

    const elapsed = Date.now() - startTime;
    const allHealthy = Object.values(checks).every(check => check === true);

    if (verbose || !allHealthy) {
      console.log(`[BrowserHealth] Health check complete (${elapsed}ms):`, checks);
    }

    return {
      healthy: allHealthy,
      checks,
      elapsed,
    };

  } catch (error) {
    console.error('[BrowserHealth] Health check failed:', (error as Error).message);
    return {
      healthy: false,
      checks,
      elapsed: Date.now() - startTime,
      error: (error as Error).message,
    };
  }
}

/**
 * Safely initializes a new page with health verification and retry logic.
 * Protects against browser crashes during page creation.
 * 
 * @param context - Browser context
 * @param options - Configuration options
 * @param options.maxRetries - Maximum initialization attempts (default: 3)
 * @param options.retryDelay - Delay between retries in ms (default: 1000)
 * @param options.verifyHealth - Run health check after creation (default: true)
 * 
 * @example
 * ```javascript
 * const page = await safePageInit(context, {
 *   maxRetries: 3,
 *   verifyHealth: true,
 * });
 * ```
 */
export async function safePageInit(
  context: BrowserContext,
  options: { maxRetries?: number; retryDelay?: number; verifyHealth?: boolean } = {}
): Promise<Page> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    verifyHealth = true,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[BrowserHealth] Page initialization attempt ${attempt}/${maxRetries}`);

      const page = await context.newPage();

      // Verify page health if requested
      if (verifyHealth) {
        const health = await verifyBrowserHealth(page, { timeout: 5000 });
        
        if (!health.healthy) {
          console.warn(`[BrowserHealth] Page unhealthy on attempt ${attempt}:`, health.checks);
          
          if (attempt < maxRetries) {
            await page.close().catch(() => {});
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }
      }

      console.log(`[BrowserHealth] Page initialized successfully on attempt ${attempt}`);
      return page;

    } catch (error) {
      lastError = error as Error;
      console.error(`[BrowserHealth] Page init failed (attempt ${attempt}/${maxRetries}):`, (error as Error).message);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw new Error(
    `Failed to initialize page after ${maxRetries} attempts. Last error: ${lastError?.message}`
  );
}

/**
 * Monitors browser process health during test execution.
 * Detects crashes and provides detailed error information.
 * 
 * @param page - The Playwright page object
 * @param callback - Callback function when crash detected
 * @returns Cleanup function to remove listeners
 * 
 * @example
 * ```javascript
 * const cleanup = monitorBrowserCrashes(page, (error) => {
 *   console.error('Browser crashed:', error);
 * });
 * 
 * // Later...
 * cleanup();
 * ```
 */
export function monitorBrowserCrashes(
  page: Page,
  callback: (crashInfo: CrashInfo) => void
): () => void {
  const crashHandler = (error: Error) => {
    console.error('[BrowserHealth] Browser crashed:', error.message);
    
    const crashInfo: CrashInfo = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      type: 'browser_crash',
    };

    if (callback) callback(crashInfo);
  };

  const errorHandler = (error: Error) => {
    if (error.message.includes('Target closed') || 
        error.message.includes('Browser closed') ||
        error.message.includes('SIGSEGV') ||
        error.message.includes('SIGTRAP')) {
      crashHandler(error);
    }
  };

  // Monitor for various crash indicators
  // The 'crash' event fires with no arguments; wrap to match crashHandler signature
  const crashEventListener = () => crashHandler(new Error('Browser page crashed'));
  page.on('crash', crashEventListener);
  page.on('pageerror', errorHandler);

  // Return cleanup function
  return () => {
    page.off('crash', crashEventListener);
    page.off('pageerror', errorHandler);
  };
}

/**
 * Waits for AudioContext to be available and functional.
 * Prevents crashes during audio initialization in headless browsers.
 * 
 * @param page - The Playwright page object
 * @param options - Configuration options
 * @param options.timeout - Maximum time to wait (default: 5000ms)
 * 
 * @example
 * ```javascript
 * const audioReady = await waitForAudioContextReady(page);
 * if (audioReady.available) {
 *   // Proceed with audio tests
 * }
 * ```
 */
export async function waitForAudioContextReady(
  page: Page,
  options: { timeout?: number } = {}
): Promise<AudioContextResult> {
  const { timeout = 5000 } = options;

  try {
    await page.waitForFunction(
      () => {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return false;

        try {
          // Try creating a test context
          const ctx = new AudioContextClass();
          const state = ctx.state;
          ctx.close();
          return state !== undefined;
        } catch (error) {
          console.error('AudioContext test failed:', error);
          return false;
        }
      },
      { timeout }
    );

    const state = await page.evaluate(() => {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      
      try {
        const ctx = new AudioContextClass();
        const s = ctx.state;
        ctx.close();
        return s;
      } catch {
        return null;
      }
    });

    console.log('[BrowserHealth] AudioContext ready, state:', state);
    return { available: true, state: state ?? undefined };

  } catch (error) {
    console.warn('[BrowserHealth] AudioContext not ready:', (error as Error).message);
    return { available: false, error: (error as Error).message };
  }
}

/**
 * Collects browser diagnostics for debugging crashes.
 * Useful for post-mortem analysis in CI environments.
 * 
 * @param page - The Playwright page object
 * 
 * @example
 * ```javascript
 * const diagnostics = await collectBrowserDiagnostics(page);
 * console.log('Browser diagnostics:', diagnostics);
 * ```
 */
export async function collectBrowserDiagnostics(page: Page): Promise<DiagnosticsResult> {
  const diagnostics: DiagnosticsResult = {
    timestamp: new Date().toISOString(),
    url: page.url(),
    viewport: null,
    userAgent: null,
    memory: null,
    console: [],
  };

  try {
    // Collect viewport info
    diagnostics.viewport = page.viewportSize();

    // Collect user agent
    diagnostics.userAgent = await page.evaluate(() => navigator.userAgent);

    // Collect memory info if available
    diagnostics.memory = await page.evaluate(() => {
      const perf = performance as Performance & { memory?: MemoryInfo };
      if (perf.memory) {
        return {
          usedJSHeapSize: perf.memory.usedJSHeapSize,
          totalJSHeapSize: perf.memory.totalJSHeapSize,
          jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
        };
      }
      return null;
    });

    // Collect recent console messages
    const messages: Array<{ type: string; text: string; timestamp: string }> = [];
    page.on('console', msg => {
      messages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString(),
      });
      if (messages.length > 50) messages.shift(); // Keep last 50
    });
    diagnostics.console = messages;

  } catch (error) {
    diagnostics.error = (error as Error).message;
  }

  return diagnostics;
}


