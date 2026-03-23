# Playwright E2E Tests

## Overview

This directory contains end-to-end tests for the Buzzy spelling bee game using Playwright.

## Test Projects

Playwright is configured with 6 test projects:

### Desktop Browsers

- **chromium** - Desktop Chrome
- **firefox** - Desktop Firefox (local only, not run in CI)
- **webkit** - Desktop Safari

### Mobile Devices

- **Mobile Chrome** - Pixel 5 (393×851)
- **Mobile Safari** - iPhone 13 (390×844)
- **iPhone SE** - Smallest modern viewport (375×667)

## Running Tests

### All Projects

```bash
# Run all tests across all projects
npm run test:e2e

# Run with UI mode (interactive)
npx playwright test --ui
```

### Specific Projects

```bash
# Run tests on a single project
npx playwright test --project=chromium
npx playwright test --project="Mobile Safari"

# Run tests on multiple specific projects
npx playwright test --project="Mobile Chrome" --project="Mobile Safari"

# Run only mobile projects
npx playwright test --project="Mobile Chrome" --project="Mobile Safari" --project="iPhone SE"
```

### Specific Test Files

```bash
# Run specific test file
npx playwright test mobile-config-validation

# Run specific test file on specific project
npx playwright test mobile-config-validation --project="iPhone SE"

# Run audio/TTS tests
npx playwright test persistence-mastered-words

# Run with audio debugging
DEBUG=pw:api npx playwright test persistence-mastered-words
```

### Debug Mode

```bash
# Run tests in debug mode with Playwright Inspector
npx playwright test --debug

# Debug specific test
npx playwright test mobile-config-validation --debug --project="Mobile Safari"
```

## Audio Testing

### Overview

The game uses Text-to-Speech (TTS) and Web Audio APIs. Since headless browsers don't support real audio, we provide comprehensive mocking infrastructure.

### Audio Mock Infrastructure

Located in `tests/e2e/helpers/audio-mocks.js`, provides:

- **speechSynthesis API Mock**: Full TTS lifecycle simulation
- **AudioContext Mock**: Web Audio API node mocking
- **Speech Tracking**: Capture and verify spoken text
- **Wait Helpers**: Async utilities for speech operations
- **Testing Utilities**: Verification and debugging tools

### Basic Usage

```javascript
import { test, expect } from '@playwright/test';
import {
  mockSpeechSynthesis,
  mockAudioContext,
  waitForSpeech,
  getSpokenText,
  clearSpokenText,
} from './helpers/audio-mocks.js';

test.beforeEach(async ({ page }) => {
  // Initialize audio mocks before each test
  await mockSpeechSynthesis(page);
  await mockAudioContext(page);
});

test('should announce word via TTS', async ({ page }) => {
  await page.goto('/');
  
  // Clear any previous speech
  await clearSpokenText(page);
  
  // Trigger action that causes TTS
  await page.click('button:has-text("Start Game")');
  
  // Wait for specific text to be spoken
  await waitForSpeech(page, 'Your word is', 5000);
  
  // Verify all spoken text
  const spoken = await getSpokenText(page);
  expect(spoken.length).toBeGreaterThan(0);
});
```

### Audio Mock API

#### `mockSpeechSynthesis(page, options)`
Initializes TTS mock with configurable behavior.

```javascript
// Default usage
await mockSpeechSynthesis(page);

// With custom options
await mockSpeechSynthesis(page, {
  speakDelay: 50,        // Delay before firing onstart (ms)
  speakDuration: 100,    // Duration of speech simulation (ms)
  simulateErrors: false, // Randomly simulate TTS errors
});
```

#### `mockAudioContext(page)`
Initializes Web Audio API mock.

```javascript
await mockAudioContext(page);
```

#### `waitForSpeech(page, expectedText, timeout)`
Wait for specific text to be spoken (case-insensitive substring match).

```javascript
// Wait for text with default 5s timeout
await waitForSpeech(page, 'spell the word');

// Custom timeout
await waitForSpeech(page, 'correct', 3000);
```

#### `waitForAnySpeech(page, timeout)`
Wait for any speech to occur.

```javascript
await waitForAnySpeech(page, 5000);
```

#### `getSpokenText(page)`
Get array of all spoken text.

```javascript
const spoken = await getSpokenText(page);
console.log('Spoken:', spoken); // ['Your word is: apple', 'Correct!']
```

#### `getLastSpokenText(page)`
Get the most recently spoken text.

```javascript
const lastSpoken = await getLastSpokenText(page);
console.log('Last:', lastSpoken); // 'Correct!'
```

#### `getSpeechHistory(page)`
Get detailed history with metadata.

```javascript
const history = await getSpeechHistory(page);
// [{ text: 'apple', timestamp: 1234567890, lang: 'en-US', rate: 1, ... }]
```

#### `clearSpokenText(page)`
Clear speech history.

```javascript
await clearSpokenText(page);
```

#### `verifyTTSWorking(page)`
Verify mock is properly initialized.

```javascript
const status = await verifyTTSWorking(page);
console.log(status);
// {
//   hasSynthesis: true,
//   hasUtterance: true,
//   hasTracking: true,
//   canGetVoices: true,
//   voiceCount: 2,
//   voices: [{ name: 'Mock Voice - English (US)', lang: 'en-US' }, ...]
// }
```

#### `testSpeech(page, text)`
Test TTS by speaking and verifying capture.

```javascript
const success = await testSpeech(page, 'hello');
expect(success).toBe(true);
```

#### `extractSpokenWord(spokenMessage)`
Extract word from various TTS message formats.

```javascript
const word = extractSpokenWord('Your word is: apple');
console.log(word); // 'apple'
```

### Test Patterns

#### Pattern 1: Test Word Announcement

```javascript
test('announces word on game start', async ({ page }) => {
  await mockSpeechSynthesis(page);
  await page.goto('/');
  
  await clearSpokenText(page);
  await page.click('button:has-text("Start")');
  
  // Wait for announcement
  await waitForSpeech(page, 'word');
  
  const spoken = await getSpokenText(page);
  expect(spoken.some(text => text.includes('word'))).toBe(true);
});
```

#### Pattern 2: Test Multiple Speech Events

```javascript
test('provides audio feedback throughout game', async ({ page }) => {
  await mockSpeechSynthesis(page);
  await page.goto('/');
  
  await clearSpokenText(page);
  
  // Start game
  await page.click('button:has-text("Start")');
  await waitForAnySpeech(page);
  
  // Submit answer
  await page.fill('input', 'test');
  await page.click('button:has-text("Submit")');
  await waitForSpeech(page, 'correct');
  
  // Verify sequence
  const history = await getSpeechHistory(page);
  expect(history.length).toBeGreaterThanOrEqual(2);
});
```

#### Pattern 3: Test Speech with User Context

```javascript
test('reopened page maintains audio', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await mockSpeechSynthesis(page);
  await mockAudioContext(page);
  
  // First session
  await page.goto('/');
  const storageState = await context.storageState();
  await context.close();
  
  // Second session
  const newContext = await browser.newContext({ storageState });
  const newPage = await newContext.newPage();
  
  // Re-initialize mocks for new page
  await mockSpeechSynthesis(newPage);
  await mockAudioContext(newPage);
  
  await newPage.goto('/');
  await waitForAnySpeech(newPage);
  
  await newContext.close();
});
```

### Troubleshooting Audio Tests

#### "No spoken text captured" Error

**Cause**: TTS didn't fire or mock not initialized.

**Solution**:
```javascript
// 1. Verify mocks are initialized
test.beforeEach(async ({ page }) => {
  await mockSpeechSynthesis(page);
  await mockAudioContext(page);
});

// 2. Verify TTS is working
const status = await verifyTTSWorking(page);
console.log('TTS Status:', status);

// 3. Test the mock directly
const worked = await testSpeech(page, 'test');
expect(worked).toBe(true);
```

#### Race Conditions

**Cause**: Test checks for speech before TTS completes.

**Solution**:
```javascript
// Use waitForSpeech instead of immediate checks
await waitForSpeech(page, 'expected text', 5000);

// Or waitForAnySpeech if content is dynamic
await waitForAnySpeech(page, 5000);
```

#### Speech Not in Expected Format

**Cause**: TTS message format varies.

**Solution**:
```javascript
// Use substring matching
await waitForSpeech(page, 'word'); // Matches any text containing 'word'

// Or use extractSpokenWord helper
const lastSpoken = await getLastSpokenText(page);
const word = extractSpokenWord(lastSpoken);
```

#### Multiple Speech Events

**Cause**: Need to track specific speech in sequence.

**Solution**:
```javascript
// Clear before each action
await clearSpokenText(page);
await triggerAction(page);
await waitForSpeech(page, 'expected');

// Or use history with timestamps
const history = await getSpeechHistory(page);
const recent = history.filter(h => h.timestamp > Date.now() - 1000);
```

#### Tests Fail in Headless Mode Only

**Cause**: Real TTS used instead of mock.

**Solution**:
```javascript
// Ensure mocks are in beforeEach, not in test body
test.beforeEach(async ({ page }) => {
  // Must be before navigation
  await mockSpeechSynthesis(page);
  await mockAudioContext(page);
});

test('my test', async ({ page }) => {
  // Now navigate
  await page.goto('/');
});
```

### Best Practices for Audio Testing

1. **Always Initialize Mocks First**
   ```javascript
   test.beforeEach(async ({ page }) => {
     await mockSpeechSynthesis(page);
     await mockAudioContext(page);
   });
   ```

2. **Clear Speech History Between Actions**
   ```javascript
   await clearSpokenText(page);
   await triggerAction(page);
   await waitForSpeech(page, 'expected');
   ```

3. **Use Substring Matching**
   ```javascript
   // Good: flexible matching
   await waitForSpeech(page, 'correct');
   
   // Avoid: exact matching
   await waitForSpeech(page, 'Correct! The spelling is correct.');
   ```

4. **Add Generous Timeouts**
   ```javascript
   // TTS can be slow, use 5s timeout
   await waitForSpeech(page, 'text', 5000);
   ```

5. **Debug with Logging**
   ```javascript
   const spoken = await getSpokenText(page);
   console.log('All spoken text:', spoken);
   
   const history = await getSpeechHistory(page);
   console.log('Speech history:', history);
   ```

6. **Re-initialize for New Pages**
   ```javascript
   // When creating new contexts/pages
   const newPage = await context.newPage();
   await mockSpeechSynthesis(newPage);
   await mockAudioContext(newPage);
   ```

7. **Handle Async Speech**
   ```javascript
   // Don't check immediately
   await page.click('button');
   const spoken = await getSpokenText(page); // ❌ May be empty
   
   // Wait first
   await page.click('button');
   await waitForAnySpeech(page); // ✅ Waits for speech
   const spoken = await getSpokenText(page);
   ```

## Visual Regression Testing

Visual regression tests use Playwright's built-in `toHaveScreenshot()` API to catch
unintended CSS/layout regressions across critical pages and UI states.

Test file: `tests/e2e/visual-regression.spec.js`

Screenshots are captured on the **`chromium` project only** (not "Mobile Chrome"
or other projects) to avoid cross-platform rendering differences. Snapshot files
live under:

```
tests/e2e/visual-regression.spec.js-snapshots/
└── login-page-chromium-linux.png
└── home-page-idle-chromium-linux.png
└── ...   # one file per snapshot, named automatically by Playwright
```

### Test Coverage

**Phase 1 — High Priority**
- Login page
- Welcome screen (first-time user flow)
- Home page (idle state)
- Settings dialog

**Phase 2 — Medium Priority**
- Feedback dialog
- Mobile home page (375×667 – iPhone SE)
- Mobile settings dialog
- Mobile feedback dialog

### Generating Baseline Screenshots

> ⚠️ **Baselines must be generated and committed before the visual regression
> tests will pass in CI.** Without committed baselines, `toHaveScreenshot()`
> assertions fail with "Missing expected image".

Run the following commands **once**, immediately after merging or branching from
this change, to create the baseline `.png` files and commit them:

```bash
# 1. Generate baseline screenshots (Chromium project only)
npx playwright test visual-regression --update-snapshots --project=chromium

# 2. Verify the generated snapshots look correct
npx playwright show-report

# 3. Commit the generated snapshots
git add tests/e2e/visual-regression.spec.js-snapshots/
git commit -m "chore: add baseline screenshots for visual regression testing"
git push
```

Alternatively, use the dedicated npm script:

```bash
npm run test:e2e:visual:update
```

### Updating Screenshots After Intentional UI Changes

When a UI change is intentional:

1. Review screenshot diffs in the CI failure artifacts (or `playwright-report/`).
2. Verify the changes look correct.
3. Regenerate baselines locally:
   ```bash
   npx playwright test visual-regression --update-snapshots --project=chromium
   ```
4. Commit the updated `.png` files.
5. Include a brief visual-change rationale in the PR description.

### Running Visual Regression Tests

```bash
# Run only visual regression tests on Chromium
npx playwright test visual-regression --project=chromium

# Run and update any missing baselines (safe for first run)
npm run test:e2e:visual:update

# Run with HTML report to view diffs
npx playwright test visual-regression --project=chromium --reporter=html
npx playwright show-report
```

### CI Behaviour

- Screenshot tests run as part of the standard `npm run test:e2e` suite.
- Tests are scoped to the `chromium` project — they are **skipped** on all other
  projects (Firefox, WebKit, Mobile Chrome, Mobile Safari, iPhone SE).
- CI **requires committed baselines** to compare against. Without them, tests
  fail with "Missing expected image". Generate and commit baselines before
  merging (see above).
- Failure artifacts (diffs, actual screenshots) are uploaded as CI artifacts for
  review.
- The `maxDiffPixels: 100` and `threshold: 0.2` settings (see `playwright.config.ts`)
  allow minor sub-pixel rendering differences without failing the suite.

### Troubleshooting

#### "Missing expected screenshot" Error

The baseline has not been committed yet. Generate it with:

```bash
npx playwright test visual-regression --update-snapshots --project=chromium
```

#### "Screenshot does not match" After Intentional Change

Expected after a UI update. Regenerate baselines as described above.

#### Flaky Screenshots (occasional failures)

- Ensure animations are fully disabled — the helpers call `disableAnimations()`
  before every capture.
- Increase `maxDiffPixels` or `threshold` in `playwright.config.ts` if sub-pixel
  differences are unavoidable.
- Check that all network requests have settled (`waitForLoadState('networkidle')`
  is called in `prepareForScreenshot()`).

---

## Browser Installation

### Install All Browsers

```bash
# Install all browsers (chromium, firefox, webkit)
npx playwright install

# Install with system dependencies
npx playwright install --with-deps
```

### Install Specific Browsers

```bash
# Install only chromium (for Desktop Chrome + Mobile Chrome)
npx playwright install chromium

# Install only webkit (for Desktop Safari + Mobile Safari + iPhone SE)
npx playwright install webkit

# Install both chromium and webkit (used in CI)
npx playwright install chromium webkit
```

### Mobile Safari Requirements

Mobile Safari tests require the **webkit** browser to be installed:

```bash
npx playwright install --with-deps webkit
```

## Listing Tests

```bash
# List all tests
npx playwright test --list

# List tests for specific project
npx playwright test --list --project="Mobile Safari"

# Show configured devices
npx playwright show-devices
```

## Test Reports

### HTML Report

```bash
# Generate and open HTML report (after running tests)
npx playwright show-report
```

The report will open in your browser automatically. To prevent auto-opening, configure `open: 'never'` in `playwright.config.js` reporter settings.

### CI Reports

In CI, Playwright generates:
- GitHub Actions annotations for failures
- HTML report artifact (available for 7 days)

## Writing Mobile Tests

### Relying on Project Configuration

```javascript
import { test, expect } from '@playwright/test';

// Tests run with the viewport configured for each project
test('should load on mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Buzzy/i);
  
  // Test will use viewport from project config
  // Mobile Chrome: 393×851, Mobile Safari: 390×844, iPhone SE: 375×667
});
```

### Overriding Device for Specific Tests

```javascript
import { test, expect, devices } from '@playwright/test';

test.describe('Specific device tests', () => {
  test.use(devices['iPhone 13']);

  test('should load on iPhone 13', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Buzzy/i);
  });
});
```

**Note**: Using `test.use()` overrides the project's device config for that test, which means the test will run with the same viewport across all projects.

### Touch Interactions

```javascript
// Use page.click() for cross-platform compatibility
// It handles both mouse clicks and touch taps
await page.click('[data-testid="start-button"]');

// For explicit touch events
await page.tap('[data-testid="start-button"]');
```

### Mobile-Specific Considerations

1. **Viewport Size**: Test on smallest viewport (iPhone SE 375px) to ensure UI fits
2. **Touch Targets**: Verify buttons are at least 44px for touch accessibility
3. **Virtual Keyboard**: Test that keyboard doesn't obscure input fields
4. **Orientation**: Consider testing both portrait and landscape

## Troubleshooting

### "Browser not found" Error

```bash
# Solution: Install the missing browser
npx playwright install webkit
```

### Webkit Installation Fails

```bash
# Install with system dependencies
npx playwright install --with-deps webkit

# On Ubuntu/Debian, you may need:
sudo npx playwright install-deps webkit
```

### Tests Timeout

```bash
# Increase timeout in playwright.config.js
use: {
  actionTimeout: 10000, // 10 seconds
  navigationTimeout: 30000, // 30 seconds
}
```

### Port Already in Use

If port 4173 is already in use:

```bash
# Find and kill the process
lsof -ti:4173 | xargs kill -9

# Or change the port in playwright.config.js
```

## CI/CD

### GitHub Actions

CI runs tests on 5 projects (Firefox excluded to save time):

1. CI installs `chromium` and `webkit` browsers only
2. Tests run on: **chromium**, **webkit**, **Mobile Chrome**, **Mobile Safari**, **iPhone SE**
3. HTML report is uploaded as artifact (available for 7 days)
4. Firefox is configured but only runs locally (not installed in CI)

**Projects Run in CI**: 5 (3 desktop + 3 mobile, excluding Firefox)  
**Total Projects Configured**: 6 (Firefox available for local testing)

### Local CI Simulation

```bash
# Simulate CI environment (runs only CI projects)
CI=true CI_USE_DIST=true npx playwright test --project=chromium --project=webkit --project="Mobile Chrome" --project="Mobile Safari" --project="iPhone SE"
```

## File Structure

```
tests/e2e/
├── README.md                           # This file
├── helpers/
│   ├── audio-mocks.js                  # Audio/TTS mocking infrastructure
│   ├── test-helpers.js                 # General test utilities
│   └── wait-helpers.js                 # Async wait utilities
├── mobile-config-validation.spec.js    # Mobile config validation tests
├── persistence-mastered-words.spec.js  # Persistence tests with audio
└── [other test files]                  # Game-specific E2E tests
```

## Available Device Presets

Playwright includes many device presets. Common ones:

**Mobile Phones:**
- `Pixel 5`
- `iPhone 13`, `iPhone 13 Pro`, `iPhone 13 Pro Max`
- `iPhone SE`
- `Galaxy S9+`, `Galaxy S21`

**Tablets:**
- `iPad (gen 7)`, `iPad Pro 11`
- `Galaxy Tab S4`

See full list: https://playwright.dev/docs/emulation#devices

## Best Practices

1. **Test on Multiple Devices**: Run tests on at least one Android and one iOS device
2. **Test Smallest Viewport**: Always test on iPhone SE (375px) to catch layout issues
3. **Use Cross-Platform Actions**: Prefer `page.click()` over `page.tap()` for better compatibility
4. **Verify Touch Targets**: Ensure interactive elements are large enough (44px minimum)
5. **Test Keyboard Behavior**: Verify virtual keyboard doesn't obscure critical UI
6. **Let Projects Define Viewports**: Avoid `test.use()` overrides unless testing specific device behavior
7. **Mock Audio APIs**: Always use audio-mocks.js for TTS/AudioContext testing
8. **Clear Speech History**: Use `clearSpokenText()` between test actions
9. **Wait for Speech**: Use `waitForSpeech()` instead of immediate checks
10. **Re-initialize Mocks**: For new pages/contexts, re-run mock initialization

## References

- [Playwright Documentation](https://playwright.dev/)
- [Emulation Guide](https://playwright.dev/docs/emulation)
- [Available Devices](https://playwright.dev/docs/emulation#devices)
- [Mobile Testing](https://playwright.dev/docs/test-use-options#mobile)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
