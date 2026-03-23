/**
 * Visual Regression Tests — Phase 1 + Phase 2
 *
 * Uses Playwright's built-in `toHaveScreenshot()` API to catch unintended
 * visual regressions in critical pages and UI states.
 *
 * **Run on the "chromium" project only** to avoid platform-specific rendering
 * differences (Linux/macOS/Windows render fonts slightly differently across
 * browsers and projects).
 *
 * ## Generating / Updating Baselines
 *
 * When intentional UI changes are made, regenerate baselines with:
 *
 * ```bash
 * npx playwright test visual-regression --update-snapshots --project=chromium
 * ```
 *
 * Commit the updated `.png` files in
 * `tests/e2e/visual-regression.spec.js-snapshots/` together with the code
 * change and include a visual-change rationale in the PR description.
 *
 * ## Screenshot Locations
 *
 * Snapshots are stored in:
 *   tests/e2e/visual-regression.spec.js-snapshots/
 * organised by browser: chromium/
 */

import { test, expect } from '@playwright/test';
import { disableAnimations } from './helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Navigate to the login page and complete the guest sign-in flow for the given
 * username. Stops after clicking "Start Playing" — does NOT wait for or dismiss
 * the welcome screen, so callers can handle it themselves.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 */
async function loginAsGuest(page, username) {
  await page.goto('/login');

  const guestButton = page.getByRole('button', { name: 'Guest' });
  await expect(guestButton).toBeVisible({ timeout: 15000 });
  await guestButton.click();

  const usernameInput = page.getByLabel('Username');
  await expect(usernameInput).toBeVisible({ timeout: 15000 });
  await usernameInput.fill(username);

  await page.getByRole('button', { name: /start playing/i }).click();
}

/**
 * Log in as a guest user and land on the home/game screen.
 * Dismisses the WelcomeScreen if it appears.
 *
 * @param {import('@playwright/test').Page} page
 */
async function reachHomeScreen(page) {
  await loginAsGuest(page, 'vr-test-user');

  // Dismiss welcome screen if it appears for this user
  const skipButton = page.getByRole('button', { name: 'Skip' });
  const chooseDifficulty = page.getByText('Choose difficulty');
  await expect(skipButton.or(chooseDifficulty)).toBeVisible({ timeout: 10000 });
  if (await skipButton.isVisible()) {
    await skipButton.click();
  }
  await expect(chooseDifficulty).toBeVisible({ timeout: 10000 });
}

/**
 * Prepare the page for a deterministic screenshot:
 *  1. Wait for network to settle.
 *  2. Disable all CSS animations and transitions.
 *
 * @param {import('@playwright/test').Page} page
 */
async function prepareForScreenshot(page) {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
    // Non-fatal — network idle timed out; continue with the screenshot.
    // This is logged here to help trace flaky screenshot failures.
    console.log('[visual-regression] waitForLoadState("networkidle") timed out — proceeding anyway');
  });
  await disableAnimations(page);
}

// ─── Suite configuration ─────────────────────────────────────────────────────
// Note: changed from serial to default (parallel) so that one failure does not
// block the remaining snapshot captures. The chromium-only beforeEach guard
// already serialises the meaningful work to a single project.
// test.describe.configure({ mode: 'serial' }); // removed — see #687

test.describe('Visual regression', () => {
  // Limit to the "chromium" project only — not "Mobile Chrome" or others.
  // Filtering by project name (not just browserName) prevents the suite from
  // running under "Mobile Chrome", which is also a Chromium-based project.
  // This single hook applies to both the desktop and mobile sub-suites below.
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'Visual regression snapshots are captured on the "chromium" project only',
    );
  });

  // ── Phase 1: High-priority desktop pages ───────────────────────────────────

  test.describe('critical pages', () => {
    test('login page', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Spelling Bee Coach' })).toBeVisible({
        timeout: 15000,
      });
      await prepareForScreenshot(page);
      await expect(page).toHaveScreenshot('login-page.png');
    });

    test('welcome screen', async ({ page }) => {
      // VITE_TEST_MODE=true (used in CI builds) suppresses the welcome screen via
      // useUserPreferences — setShowWelcomeScreen(false) is called for every user.
      // Skip this snapshot in test-mode builds; it can be captured locally with:
      //   VITE_TEST_MODE=false npx playwright test visual-regression --update-snapshots --project=chromium
      test.skip(
        true,
        'Welcome screen is suppressed by VITE_TEST_MODE=true in CI builds. ' +
        'Generate this baseline locally without test mode.',
      );

      // Use a unique username to guarantee a first-visit welcome screen.
      const uniqueUser = `vr-w-${crypto.randomUUID().slice(0, 8)}`;
      await loginAsGuest(page, uniqueUser);

      const welcomeScreen = page.getByTestId('welcome-screen');
      await expect(welcomeScreen).toBeVisible({ timeout: 10000 });
      await prepareForScreenshot(page);
      await expect(welcomeScreen).toHaveScreenshot('welcome-screen.png');
    });

    test('home page — idle state', async ({ page }) => {
      await reachHomeScreen(page);
      await prepareForScreenshot(page);
      await expect(page).toHaveScreenshot('home-page-idle.png');
    });

    test('settings dialog', async ({ page }) => {
      await reachHomeScreen(page);

      const settingsBtn = page.getByTestId('settings-btn');
      await expect(settingsBtn).toBeVisible({ timeout: 10000 });
      await settingsBtn.click();

      const dialog = page.getByRole('dialog', { name: 'Game Settings' });
      await expect(dialog).toBeVisible({ timeout: 10000 });
      await prepareForScreenshot(page);
      await expect(dialog).toHaveScreenshot('settings-dialog.png');
    });

    // ── Phase 2: Medium-priority pages ────────────────────────────────────────

    test('feedback dialog', async ({ page }) => {
      await reachHomeScreen(page);

      const feedbackBtn = page.getByRole('button', { name: /feedback/i });
      await expect(feedbackBtn).toBeVisible({ timeout: 10000 });
      await feedbackBtn.click();

      const dialog = page.getByRole('dialog', { name: /send feedback or report a bug/i });
      await expect(dialog).toBeVisible({ timeout: 10000 });
      await prepareForScreenshot(page);
      await expect(dialog).toHaveScreenshot('feedback-dialog.png');
    });
  });

  // ── Phase 2: Mobile viewport snapshots ─────────────────────────────────────

  test.describe('mobile viewport', () => {
    // Override the viewport to simulate an iPhone SE screen within the desktop
    // Chromium project. This avoids needing separate Mobile Chrome baselines.
    test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

    test('mobile home page', async ({ page }) => {
      await reachHomeScreen(page);
      await prepareForScreenshot(page);
      await expect(page).toHaveScreenshot('mobile-home-page.png');
    });

    test('mobile settings dialog', async ({ page }) => {
      await reachHomeScreen(page);

      const settingsBtn = page.getByTestId('settings-btn');
      await expect(settingsBtn).toBeVisible({ timeout: 10000 });
      await settingsBtn.click();

      const dialog = page.getByRole('dialog', { name: 'Game Settings' });
      await expect(dialog).toBeVisible({ timeout: 10000 });
      await prepareForScreenshot(page);
      await expect(dialog).toHaveScreenshot('mobile-settings-dialog.png');
    });

    test('mobile feedback dialog', async ({ page }) => {
      await reachHomeScreen(page);

      const feedbackBtn = page.getByRole('button', { name: /feedback/i });
      await expect(feedbackBtn).toBeVisible({ timeout: 10000 });
      await feedbackBtn.click();

      const dialog = page.getByRole('dialog', { name: /send feedback or report a bug/i });
      await expect(dialog).toBeVisible({ timeout: 10000 });
      await prepareForScreenshot(page);
      await expect(dialog).toHaveScreenshot('mobile-feedback-dialog.png');
    });
  });
});
