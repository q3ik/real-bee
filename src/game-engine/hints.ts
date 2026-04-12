/**
 * hints.ts — Pure hint computation logic for the spelling bee game.
 *
 * Ported from buzzy-game/src/game-engine/hints.ts and extended to support
 * the real-bee Word schema fields: usageExample, definition, partOfSpeech.
 *
 * All functions are pure (no side-effects, no React) so they are easily
 * unit-testable and reusable outside of hooks.
 */

import type { Word } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The four semantic hint categories sourced from word schema fields,
 * plus structural hints derived from the word's shape.
 */
export type HintType =
  | "definition"
  | "use-in-sentence"
  | "part-of-speech"
  | "first-letter"
  | "vowel"
  | "double"
  | "length"
  | "last"
  | "syllables";

/**
 * A resolved hint ready to display and/or speak.
 */
export interface HintResult {
  /** The hint category. */
  type: HintType;
  /** Human-readable text to display in the UI. */
  content: string;
  /** Cost deducted from the round score when this hint is used. */
  costInPoints: number;
}

// ---------------------------------------------------------------------------
// Point costs per hint type
// Semantic hints (sourced from word data) cost more than structural hints.
// ---------------------------------------------------------------------------

const HINT_COSTS: Record<HintType, number> = {
  definition: 3,
  "use-in-sentence": 3,
  "part-of-speech": 2,
  "first-letter": 1,
  vowel: 1,
  double: 1,
  length: 1,
  last: 1,
  syllables: 1,
};

// Priority order in which hints are offered when the caller does not specify a type.
const HINT_PRIORITY: HintType[] = [
  "first-letter",
  "length",
  "vowel",
  "syllables",
  "part-of-speech",
  "definition",
  "use-in-sentence",
  "double",
  "last",
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Escape regex metacharacters so a word is treated as a literal string.
 * Mirrors the implementation in src/entities/index.ts to avoid a circular dep.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Compute a single hint for `word` of the requested `type`.
 *
 * Returns `null` when the requested hint type is not available for the given
 * word (e.g. `use-in-sentence` when both `word.usageExample` and
 * `word.sentence` are absent).
 */
export function getHint(word: Word, type: HintType): HintResult | null {
  const cost = HINT_COSTS[type];

  switch (type) {
    case "definition": {
      if (!word.definition) return null;
      return { type, content: word.definition, costInPoints: cost };
    }

    case "use-in-sentence": {
      // AC item 1: content must equal word.usageExample (or word.sentence as
      // fallback). The raw sentence is returned — no blanking — so that
      // HintResult.content === word.usageExample as required.
      const example = word.usageExample ?? word.sentence;
      if (!example) return null;
      return { type, content: example, costInPoints: cost };
    }

    case "part-of-speech": {
      if (!word.partOfSpeech) return null;
      return {
        type,
        content: `Part of speech: ${word.partOfSpeech}`,
        costInPoints: cost,
      };
    }

    case "first-letter": {
      if (!word.word) return null;
      return {
        type,
        content: `The first letter is ${word.word[0].toUpperCase()}`,
        costInPoints: cost,
      };
    }

    case "vowel": {
      const startsWithVowel = /^[aeiou]/i.test(word.word);
      return {
        type,
        content: startsWithVowel
          ? "Starts with a vowel"
          : "Starts with a consonant",
        costInPoints: cost,
      };
    }

    case "double": {
      const match = word.word.match(/(.)(\1)/);
      if (!match) return null;
      return {
        type,
        content: `Contains a double letter (${match[1].toUpperCase()})`,
        costInPoints: cost,
      };
    }

    case "length": {
      return {
        type,
        content: `${word.word.length} letters long`,
        costInPoints: cost,
      };
    }

    case "last": {
      // Bug fix: guard against empty word string (mirrors first-letter guard).
      if (!word.word) return null;
      return {
        type,
        content: `Ends with '${word.word[word.word.length - 1].toUpperCase()}'`,
        costInPoints: cost,
      };
    }

    case "syllables": {
      if (!word.syllables) return null;
      const count = word.syllables.split("-").length;
      return {
        type,
        content: `${count} syllable${count !== 1 ? "s" : ""}`,
        costInPoints: cost,
      };
    }

    default: {
      // Exhaustive check — TypeScript will error if a case is missing.
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/**
 * Return the ordered list of hint types still available for `word` after
 * excluding any already used.
 *
 * Types are filtered out when:
 *  - They have already been used (`usedHints` contains them), OR
 *  - The word lacks the required data field (e.g. no `partOfSpeech`).
 */
export function getAvailableHints(
  word: Word,
  usedHints: HintType[],
): HintType[] {
  return HINT_PRIORITY.filter((type) => {
    if (usedHints.includes(type)) return false;
    // Probe whether the hint can actually be generated for this word.
    return getHint(word, type) !== null;
  });
}

// Keep escapeRegex accessible for tests / future callers within this module.
export { escapeRegex };
