import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Coverage threshold enforced across all tested modules
const COVERAGE_THRESHOLD = 80;

// Detect CI environment (handles multiple CI systems)
const isCI =
  process.env.CI === "true" || process.env.CI === "1" || !!process.env.CI;

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup/polyfill.ts", "./src/test/setup.tsx"],
    include: [
      "src/**/*.{test,spec}.{js,jsx,ts,tsx}",
      "functions/**/*.{test,spec}.{js,jsx,ts,tsx}",
      "tests/security/**/*.{test,spec}.{js,jsx,ts,tsx}",
      // Fix: Include E2E helper tests for unit testing
      "tests/e2e/helpers/**/*.{test,spec}.{js,jsx,ts,tsx}",
    ],
    exclude: [
      "node_modules",
      "dist",
      // Exclude E2E spec files (integration tests) but allow helper unit tests
      "tests/e2e/**/*.spec.js",
      "**/*.e2e.{test,spec}.{js,jsx}",
      // Phase 1: offline-sync imports idb/@/lib/sync/@/services/progressSync which don't exist yet
      "src/test/integration/offline-sync.test.ts",
    ],
    // Fix #668: Use forks pool for process-level isolation between test files.
    // vmForks shares the vi.mock() registry within a worker, causing cross-file
    // mock contamination (e.g. WelcomeScreen stub leaking between Home test files).
    // forks spawns a real child process per fork, fully isolating module registries.
    pool: "forks",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/setup.tsx",
        "**/*.config.{js,ts}",
        "**/test-utils.jsx",
        "**/__tests__/**",
      ],
      // Enforce global coverage thresholds
      thresholds: {
        global: {
          branches: COVERAGE_THRESHOLD,
          functions: COVERAGE_THRESHOLD,
          lines: COVERAGE_THRESHOLD,
          statements: COVERAGE_THRESHOLD,
        },
      },
    },
    // Fix #668: Increase timeouts for CI stability
    testTimeout: isCI ? 15000 : 10000,
    hookTimeout: isCI ? 15000 : 10000,
  },
  define: {
    // Enable test mode — bypasses welcome screens and debounce guards
    "import.meta.env.VITE_TEST_MODE": JSON.stringify("true"),
    // Provide fallback Supabase credentials for test environments
    // These are read by src/lib/supabase.js at module evaluation time
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      process.env.VITE_SUPABASE_URL || "http://localhost:54321",
    ),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
      process.env.VITE_SUPABASE_ANON_KEY || "test-anon-key",
    ),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
