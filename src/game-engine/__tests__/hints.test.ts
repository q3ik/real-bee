/**
 * Unit tests for src/game-engine/hints.ts
 *
 * Covers all four schema-sourced hint types, structural hints, exhausted hints,
 * and already-used hint filtering. No mocks — all functions are pure.
 */

import { describe, it, expect } from "vitest";
import { getHint, getAvailableHints } from "../hints";
import type { Word } from "../../types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_WORD: Word = {
  word: "elephant",
  definition: "A very large animal with a long trunk.",
  sentence: "The elephant drank from the river.",
  usageExample: "We saw an elephant at the zoo.",
  partOfSpeech: "noun",
  syllables: "el-e-phant",
  grade: 3,
  difficulty: "medium",
};

const MINIMAL_WORD: Word = {
  word: "cat",
  definition: "A small furry pet.",
  sentence: "The cat sat on the mat.",
  grade: 1,
  difficulty: "easy",
};

const DOUBLE_LETTER_WORD: Word = {
  word: "apple",
  definition: "A crunchy fruit.",
  sentence: "She ate an apple.",
  grade: 1,
  difficulty: "easy",
};

// ---------------------------------------------------------------------------
// getHint — semantic hint types (AC items 1-3)
// ---------------------------------------------------------------------------

describe("getHint — definition", () => {
  it("returns HintResult with content === word.definition", () => {
    const result = getHint(FULL_WORD, "definition");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("definition");
    expect(result!.content).toBe(FULL_WORD.definition);
    expect(result!.costInPoints).toBeGreaterThan(0);
  });

  it("returns null when definition is absent", () => {
    const result = getHint(
      { ...FULL_WORD, definition: "" } as unknown as Word,
      "definition",
    );
    expect(result).toBeNull();
  });
});

describe("getHint — use-in-sentence", () => {
  it("returns content === word.usageExample (AC item 1: no blanking)", () => {
    const result = getHint(FULL_WORD, "use-in-sentence");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("use-in-sentence");
    // AC item 1: content must equal the raw usageExample — no blanking applied.
    expect(result!.content).toBe(FULL_WORD.usageExample);
    expect(result!.content).toContain("elephant");
  });

  it("falls back to word.sentence when usageExample is absent", () => {
    const result = getHint(MINIMAL_WORD, "use-in-sentence");
    expect(result).not.toBeNull();
    expect(result!.content).toBe(MINIMAL_WORD.sentence);
  });

  it("returns null when both usageExample and sentence are absent", () => {
    const wordNoSentence = {
      ...FULL_WORD,
      usageExample: undefined,
      sentence: "",
    } as unknown as Word;
    const result = getHint(wordNoSentence, "use-in-sentence");
    expect(result).toBeNull();
  });
});

describe("getHint — part-of-speech", () => {
  it("returns content with partOfSpeech when present", () => {
    const result = getHint(FULL_WORD, "part-of-speech");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("part-of-speech");
    expect(result!.content).toContain("noun");
  });

  it("returns null when partOfSpeech is absent", () => {
    const result = getHint(MINIMAL_WORD, "part-of-speech");
    expect(result).toBeNull();
  });
});

describe("getHint — first-letter", () => {
  it("returns the first letter uppercased", () => {
    const result = getHint(FULL_WORD, "first-letter");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("first-letter");
    expect(result!.content).toContain("E");
  });

  it("returns null for empty word string", () => {
    const result = getHint(
      { ...FULL_WORD, word: "" } as unknown as Word,
      "first-letter",
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getHint — structural hint types
// ---------------------------------------------------------------------------

describe("getHint — structural hints", () => {
  it("vowel hint identifies vowel start", () => {
    const result = getHint(FULL_WORD, "vowel");
    expect(result!.content).toMatch(/vowel/i);
  });

  it("vowel hint identifies consonant start", () => {
    const result = getHint(MINIMAL_WORD, "vowel");
    expect(result!.content).toMatch(/consonant/i);
  });

  it("double hint detects repeated letter", () => {
    const result = getHint(DOUBLE_LETTER_WORD, "double");
    expect(result).not.toBeNull();
    expect(result!.content).toContain("P");
  });

  it("double hint returns null for word with no double letter", () => {
    const result = getHint(MINIMAL_WORD, "double");
    expect(result).toBeNull();
  });

  it("length hint returns correct letter count", () => {
    const result = getHint(FULL_WORD, "length");
    expect(result!.content).toContain("8");
  });

  it("last hint returns the final letter uppercased", () => {
    const result = getHint(FULL_WORD, "last");
    expect(result).not.toBeNull();
    expect(result!.content).toContain("T");
  });

  it("last hint returns null for empty word string", () => {
    const result = getHint(
      { ...FULL_WORD, word: "" } as unknown as Word,
      "last",
    );
    expect(result).toBeNull();
  });

  it("syllables hint returns correct count", () => {
    const result = getHint(FULL_WORD, "syllables");
    expect(result!.content).toContain("3");
  });

  it("syllables hint returns null when syllables absent", () => {
    const result = getHint(MINIMAL_WORD, "syllables");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getAvailableHints — deduplication and exhaustion (AC items 4, 5)
// ---------------------------------------------------------------------------

describe("getAvailableHints", () => {
  it("returns all available hint types for a fully-populated word", () => {
    const available = getAvailableHints(FULL_WORD, []);
    expect(available.length).toBeGreaterThan(0);
    // All four semantic types should be present
    expect(available).toContain("definition");
    expect(available).toContain("use-in-sentence");
    expect(available).toContain("part-of-speech");
    expect(available).toContain("first-letter");
  });

  it("excludes already-used hint types", () => {
    const available = getAvailableHints(FULL_WORD, ["first-letter", "length"]);
    expect(available).not.toContain("first-letter");
    expect(available).not.toContain("length");
  });

  it("excludes hint types not supported by the word data", () => {
    // MINIMAL_WORD has no partOfSpeech, usageExample, or syllables
    const available = getAvailableHints(MINIMAL_WORD, []);
    expect(available).not.toContain("part-of-speech");
    expect(available).not.toContain("syllables");
  });

  it("returns empty array when all hints are exhausted", () => {
    const first = getAvailableHints(MINIMAL_WORD, []);
    const available = getAvailableHints(MINIMAL_WORD, first);
    expect(available).toHaveLength(0);
  });
});
