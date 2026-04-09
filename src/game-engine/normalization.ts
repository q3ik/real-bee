import {
  NATO_TO_LETTER,
  LETTER_TO_SYMBOL,
  DIGIT_WORDS,
  COMMON_FILLER_WORDS,
} from './alphabet';

/**
 * Normalizes spelling input from voice or keyboard.
 * Handles NATO phonetic alphabet, common letter pronunciations, and filler words.
 */
export function normalizeSpelling(input: string | null | undefined): string {
  if (!input) return '';

  // 1. Initial cleanup: uppercase for matching, split into words
  const words = input.trim().toUpperCase().split(/[\s-]+/);
  const result: string[] = [];

  for (const word of words) {
    if (!word) continue;

    // 2. Skip common filler words (e.g., "CAPITAL", "LETTER") but only when
    //    they are multi-character so that single letters like "A" are not filtered.
    if (word.length > 1 && COMMON_FILLER_WORDS.includes(word)) continue;

    // 3. Match NATO alphabet (e.g., "ALFA" -> "A")
    if (NATO_TO_LETTER[word]) {
      result.push(NATO_TO_LETTER[word]);
      continue;
    }

    // 4. Match common pronunciations (e.g., "DOUBLE-U" -> "W")
    if (LETTER_TO_SYMBOL[word]) {
      result.push(LETTER_TO_SYMBOL[word]);
      continue;
    }

    // 5. Match digits
    if (DIGIT_WORDS[word]) {
      result.push(DIGIT_WORDS[word]);
      continue;
    }

    // 6. Handle raw letters and fallback
    if (word.length === 1 && /[A-Z0-9]/.test(word)) {
      result.push(word);
      continue;
    }

    // Otherwise, strip non-alphanumeric and keep if cleaned
    const cleaned = word.replace(/[^A-Z0-9]/g, '');
    if (cleaned) {
      result.push(cleaned);
    }
  }

  // Strip digits from final result — spelling words are letters only
  return result.join('').toLowerCase().replace(/[0-9]/g, '');
}

/**
 * Detects if the input is likely a whole word attempt rather than a spelling attempt.
 */
export function isLikelyWholeWordAttempt(input: string): boolean {
  if (!input) return false;

  const trimmed = input.trim();
  const words = trimmed.split(/[\s-]+/);

  // If it's multiple words, it's more likely a spelling attempt (e.g., "C A T")
  if (words.length > 1) return false;

  // If it's a single long word (>= 4 chars), it's likely a whole word attempt
  return trimmed.length >= 4 && !trimmed.includes(' ');
}

/**
 * Checks if the input has clear spelling indicators (spaces or separators).
 */
export function hasSpellingIndicators(input: string): boolean {
  if (!input) return false;
  return /[\s\-\.]/.test(input.trim());
}
