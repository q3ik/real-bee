import { defineConfig, devices } from '@playwright/test';

const useBuiltAppInCI = process.env.CI_USE_DIST === 'true';
const isAudioTest = process.env.TEST_AUDIO === 'true';

export default defineConfig({
  // Test directory supports both .spec.js and .spec.ts files
  testDir: './tests/e2e',
  // This project uses *.spec.ts for Playwright E2E tests and *.test.ts for Vitest unit tests.
  // Restrict Playwright to only discover *.spec files to prevent it from running Vitest tests,
  // which causes symbol conflicts.
  testMatch: [
    '**/*.spec.@(js|jsx|ts|tsx)',
    '**/*.spec.@(cjs|cts|mjs|mts)',
    '**/*.spec.@(cjsx|ctsx|mjsx|mtsx)',
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Fix #609: Increase retries from 1 to 2 for SIGSEGV crash recovery
  retries: process.env.CI ? 2 : 0,
  // Fix #609: Reduce workers to 1 for audio tests to prevent resource contention
  workers: process.env.CI ? (isAudioTest ? 1 : 2) : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  
  // Fix #609: Global setup and teardown for browser health verification
  globalSetup: './tests/e2e/global-setup',
  globalTeardown: './tests/e2e/global-teardown',
  
  // Fix #7 & #613: Increase timeout for slower CI environments
  timeout: 60000, // Per-test timeout remains at 60s
  
  // Fix #613: Configure expect timeout for assertion stability
  // Must be at root config level, not in use block
  expect: {
    timeout: process.env.CI ? 15000 : 10000,
    toHaveScreenshot: {
      // Allow small pixel differences to account for sub-pixel rendering
      maxDiffPixels: 100,
      // Pixel-level threshold (0–1); 0.2 = 20% brightness difference
      threshold: 0.2,
      // Disable animations so screenshots are deterministic
      animations: 'disabled',
    },
  },
  
  use: {
    baseURL: 'http://127.0.0.1:4173',
    // Fix #613: Enable trace AND video on first retry for better debugging
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    
    // Fix #614: Reduce motion globally to prevent WebKit element instability
    reducedMotion: 'reduce',
    
    // Fix #1, #3, #613: Increase navigation and action timeouts
    // CI environments are slower - network latency, resource contention
    navigationTimeout: process.env.CI ? 45000 : 30000,  // 15s → 30s (45s in CI)
    actionTimeout: process.env.CI ? 20000 : 15000,      // 10s → 15s (20s in CI)
  },
  
  webServer: {
    command: useBuiltAppInCI
      ? 'VITE_TEST_MODE=true npx serve -s dist -l tcp://127.0.0.1:4173'
      : 'VITE_TEST_MODE=true npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    // Fix #683: Prevent Vitest globals from loading in Playwright environment
    // This prevents Jest/Vitest matcher conflicts
    env: {
      NODE_OPTIONS: '--no-experimental-global-webcrypto',
      VITEST: 'false',  // Signal to skip Vitest-specific setup
    },
  },
  
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Fix #3, #613, #609: QA-184 - Enhanced browser flags for stability
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security', // For CORS in tests
            // Fix #609: Add memory limit to prevent OOM-related crashes
            '--max-old-space-size=4096',
          ],
          // Fix #609: Increase launch timeout for CI environment
          timeout: process.env.CI ? 60000 : 30000,
          // Fix #609: Enable graceful shutdown on signals
          handleSIGTERM: true,
          handleSIGINT: true,
          // Fix #609: Configure crash dumps directory
          ...(process.env.CI && {
            chromiumSandbox: false,
            devtools: false,
          }),
        },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'permissions.default.microphone': 1,
            'permissions.default.camera': 1,
          },
        },
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        // Fix #614: WebKit-specific stability enhancements
        // Increased timeouts for element stability
        actionTimeout: 25000,
        navigationTimeout: 40000,
      },
    },
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        // Mobile-specific stability flags
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-sandbox',
            '--max-old-space-size=4096',
          ],
          timeout: process.env.CI ? 60000 : 30000,
        },
      },
    },
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 13'],
        // Fix #614: Mobile Safari specific stability settings
        // Longest timeouts due to combined mobile + WebKit issues
        actionTimeout: 30000,
        navigationTimeout: 50000,
      },
    },
    {
      name: 'iPhone SE',
      use: { 
        ...devices['iPhone SE'],
        // Fix #614: iPhone SE stability settings
        // Small viewport can cause additional layout shifts
        actionTimeout: 30000,
        navigationTimeout: 50000,
      },
    },
  ],
});
