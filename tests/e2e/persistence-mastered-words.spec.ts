import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { dismissWelcomeScreen } from './helpers';
import {
  mockSpeechSynthesis,
  mockAudioContext,
  waitForAnySpeech,
  getLastSpokenText,
  clearSpokenText,
} from './helpers/audio-mocks';

const username = 'persist-mastered-user';

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Guest' }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByRole('button', { name: 'Start Playing' }).click();
  await expect(page.getByText('Playing as:')).toBeVisible();

  // Dismiss the WelcomeScreen if it appears
  await dismissWelcomeScreen(page);
}

/**
 * Extracts the spoken word from TTS output with multiple pattern support
 * Handles various TTS engine output formats across different browsers
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string>} The extracted word
 * @throws {Error} If unable to capture the word
 */
async function captureSpokenWord(page: Page): Promise<string> {
  // Wait for any speech to occur
  await waitForAnySpeech(page, 15000);

  const spokenMessage = await getLastSpokenText(page);

  if (!spokenMessage) {
    throw new Error('No spoken text captured. TTS may not have fired.');
  }

  // Try multiple regex patterns to handle different TTS output formats
  const patterns = [
    /Your word is[:\s]+([a-zA-Z]+)/i, // "Your word is: example" or "Your word is example"
    /Spell the word[:\s]+([a-zA-Z]+)/i, // "Spell the word: example"
    /The word is[:\s]+([a-zA-Z]+)/i, // "The word is: example"
    /word[:\s]+([a-zA-Z]+)/i, // Generic "word: example"
    /^([a-zA-Z]+)$/, // Just the word itself
  ];

  for (const pattern of patterns) {
    const match = spokenMessage.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Fallback: try to extract any standalone word from the message
  const words = spokenMessage.match(/\b[a-zA-Z]{3,}\b/g);
  if (words && words.length > 0) {
    // Return the last substantial word (likely the target word)
    return words[words.length - 1].trim();
  }

  throw new Error(
    `Unable to capture spoken word from message: "${spokenMessage}"`
  );
}

test('PERSIST-005: mastered words persist after browser restart', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Initialize audio mocks
  await mockSpeechSynthesis(page);
  await mockAudioContext(page);

  // Clear localStorage
  await page.addInitScript(() => {
    window.localStorage.clear();
  });

  await login(page);

  // Clear any speech from login/navigation
  await clearSpokenText(page);

  await page.getByRole('button', { name: 'Start Spelling Bee' }).click();

  const currentWord = await captureSpokenWord(page);
  console.log(`Captured word: ${currentWord}`);

  await page.getByPlaceholder('Type the spelling here...').fill(currentWord);
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.getByRole('heading', { name: 'Correct!' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark as Mastered' }).click();

  const storageState = await context.storageState();
  await context.close();

  const reopenedContext = await browser.newContext({ storageState });
  const reopenedPage = await reopenedContext.newPage();

  // Re-initialize audio mocks for new page
  await mockSpeechSynthesis(reopenedPage);
  await mockAudioContext(reopenedPage);

  await login(reopenedPage);

  const masteredWordsButton = reopenedPage.getByRole('button', {
    name: /Mastered Words \(1\)/,
  });
  await expect(masteredWordsButton).toBeVisible();
  await masteredWordsButton.click();

  await expect(reopenedPage.getByRole('dialog')).toContainText(currentWord);

  await reopenedContext.close();
});
