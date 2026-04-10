import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Override the global SoundManager mock from setup.tsx
vi.mock("@/game-engine/SoundManager", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...(actual as Record<string, unknown>) };
});

import type { Word } from "../../types";
import {
  normalizeSpelling,
  isLikelyWholeWordAttempt,
  hasSpellingIndicators,
} from "../normalization";
import {
  calculatePoints,
  processSpellingSubmission,
  DIFFICULTY_MULTIPLIERS,
  BASE_POINTS,
} from "../scoring";
import {
  getAdjustedDifficulty,
  getAvailableWords,
  selectRandomWord,
} from "../difficulty";
import { SoundManager, SOUND_FREQUENCIES } from "../SoundManager";

// ---------------------------------------------------------------------------
// normalization tests
// ---------------------------------------------------------------------------

describe("normalization", () => {
  describe("normalizeSpelling", () => {
    it("returns empty string for null/undefined input", () => {
      expect(normalizeSpelling(null)).toBe("");
      expect(normalizeSpelling(undefined)).toBe("");
    });

    it("handles single letters", () => {
      expect(normalizeSpelling("c a t")).toBe("cat");
    });

    it("handles NATO phonetic alphabet (lowercase)", () => {
      expect(normalizeSpelling("charlie alpha tango")).toBe("cat");
    });

    it("handles NATO phonetic alphabet (uppercase)", () => {
      expect(normalizeSpelling("CHARLIE ALFA TANGO")).toBe("cat");
    });

    it("strips filler words", () => {
      expect(normalizeSpelling("letter C letter A letter T")).toBe("cat");
      expect(normalizeSpelling("capital C capital A capital T")).toBe("cat");
    });

    it("handles digit words but strips them from output", () => {
      expect(normalizeSpelling("c one a t")).toBe("cat");
    });

    it("strips digits from final result", () => {
      expect(normalizeSpelling("1 2 3")).toBe("");
    });

    it("handles concatenated letters", () => {
      expect(normalizeSpelling("cat")).toBe("cat");
    });

    it("strips non-alphanumeric characters", () => {
      expect(normalizeSpelling("c!@#$a%^t")).toBe("cat");
    });

    it("handles hyphenated input", () => {
      expect(normalizeSpelling("c-a-t")).toBe("cat");
    });
  });

  describe("isLikelyWholeWordAttempt", () => {
    it("returns false for null input", () => {
      expect(isLikelyWholeWordAttempt("")).toBe(false);
    });

    it("returns true for single long word", () => {
      expect(isLikelyWholeWordAttempt("elephant")).toBe(true);
    });

    it("returns false for space-separated spelling", () => {
      expect(isLikelyWholeWordAttempt("c a t")).toBe(false);
    });

    it("returns false for hyphen-separated spelling", () => {
      expect(isLikelyWholeWordAttempt("c-a-t")).toBe(false);
    });

    it("returns false for short single characters", () => {
      expect(isLikelyWholeWordAttempt("a")).toBe(false);
    });
  });

  describe("hasSpellingIndicators", () => {
    it("returns false for null input", () => {
      expect(hasSpellingIndicators("")).toBe(false);
    });

    it("returns true for space-separated input", () => {
      expect(hasSpellingIndicators("c a t")).toBe(true);
    });

    it("returns true for hyphen-separated input", () => {
      expect(hasSpellingIndicators("c-a-t")).toBe(true);
    });

    it("returns true for dot-separated input", () => {
      expect(hasSpellingIndicators("c.a.t")).toBe(true);
    });

    it("returns false for concatenated input", () => {
      expect(hasSpellingIndicators("cat")).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// scoring tests
// ---------------------------------------------------------------------------

describe("scoring", () => {
  describe("DIFFICULTY_MULTIPLIERS", () => {
    it("has correct values", () => {
      expect(DIFFICULTY_MULTIPLIERS.easy).toBe(1);
      expect(DIFFICULTY_MULTIPLIERS.medium).toBe(2);
      expect(DIFFICULTY_MULTIPLIERS.hard).toBe(3);
    });
  });

  describe("BASE_POINTS", () => {
    it("is 10", () => {
      expect(BASE_POINTS).toBe(10);
    });
  });

  describe("calculatePoints", () => {
    it("calculates easy points correctly", () => {
      expect(calculatePoints("easy", 0)).toBe(10);
      expect(calculatePoints("easy", 1)).toBe(20);
    });

    it("calculates medium points correctly", () => {
      expect(calculatePoints("medium", 0)).toBe(20);
      expect(calculatePoints("medium", 2)).toBe(60);
    });

    it("calculates hard points correctly", () => {
      expect(calculatePoints("hard", 0)).toBe(30);
      expect(calculatePoints("hard", 3)).toBe(120);
    });

    it("defaults multiplier to 1 for unknown difficulty", () => {
      expect(calculatePoints("unknown" as any, 0)).toBe(10);
    });
  });

  describe("processSpellingSubmission", () => {
    it("returns correct for matching spelling", () => {
      const result = processSpellingSubmission({
        normalized: "cat",
        target: "cat",
        difficulty: "easy",
        currentStreak: 0,
        currentScore: 0,
        bestStreak: 0,
      });

      expect(result.isCorrect).toBe(true);
      expect(result.points).toBe(10);
      expect(result.newStreak).toBe(1);
      expect(result.newBestStreak).toBe(1);
      expect(result.newScore).toBe(10);
      expect(result.feedback).toBe("Correct! Well done!");
    });

    it("returns incorrect for mismatched spelling", () => {
      const result = processSpellingSubmission({
        normalized: "kat",
        target: "cat",
        difficulty: "medium",
        currentStreak: 3,
        currentScore: 60,
        bestStreak: 3,
      });

      expect(result.isCorrect).toBe(false);
      expect(result.points).toBe(0);
      expect(result.newStreak).toBe(0);
      expect(result.newBestStreak).toBe(3);
      expect(result.newScore).toBe(60);
      expect(result.feedback).toContain("c, a, t");
    });

    it("applies difficulty multiplier to points", () => {
      const result = processSpellingSubmission({
        normalized: "elephant",
        target: "elephant",
        difficulty: "hard",
        currentStreak: 0,
        currentScore: 0,
        bestStreak: 0,
      });

      expect(result.points).toBe(30); // 10 * 3 * (0 + 1)
    });
  });
});

// ---------------------------------------------------------------------------
// difficulty tests
// ---------------------------------------------------------------------------

describe("difficulty", () => {
  describe("getAdjustedDifficulty", () => {
    it("returns current difficulty if less than 5 data points", () => {
      expect(getAdjustedDifficulty("all", [true, true, true])).toBe("all");
    });

    it('returns current difficulty if not "all"', () => {
      const performance = [true, true, true, true, true];
      expect(getAdjustedDifficulty("hard", performance)).toBe("hard");
      expect(getAdjustedDifficulty("easy", performance)).toBe("easy");
    });

    it("returns a valid difficulty for good performance", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.3);
      const performance = [true, true, true, true, true];
      const result = getAdjustedDifficulty("all", performance);
      expect(["easy", "medium", "hard"]).toContain(result);
    });

    it("returns a valid difficulty for poor performance", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.3);
      const performance = [false, false, false, false, false];
      const result = getAdjustedDifficulty("all", performance);
      expect(["easy", "medium", "hard"]).toContain(result);
    });
  });

  describe("getAvailableWords", () => {
    const words: Word[] = [
      {
        word: "cat",
        definition: "A pet.",
        sentence: "The cat sat.",
        difficulty: "easy" as const,
        grade: 1,
      },
      {
        word: "dog",
        definition: "A pet.",
        sentence: "The dog barked.",
        difficulty: "easy" as const,
        grade: 1,
      },
      {
        word: "apple",
        definition: "A fruit.",
        sentence: "I ate an apple.",
        difficulty: "medium" as const,
        grade: 1,
      },
    ];

    it("returns available words filtered by difficulty", () => {
      const result = getAvailableWords(
        words,
        "easy",
        new Set(),
        new Set(),
        "all",
      );
      expect(result.availableWords).toHaveLength(2);
      expect(result.availableWords.map((w) => w.word)).toContain("cat");
      expect(result.availableWords.map((w) => w.word)).toContain("dog");
    });

    it("excludes used words", () => {
      const used = new Set(["cat"]);
      const result = getAvailableWords(words, "easy", used, new Set(), "all");
      expect(result.availableWords).toHaveLength(1);
      expect(result.availableWords[0].word).toBe("dog");
    });

    it("excludes mastered words (mostly)", () => {
      // Mock Math.random() to ensure deterministic behavior
      // We want allowMastered to be false (Math.random() >= 0.1)
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

      const mastered = new Set(["cat", "dog"]);
      const result = getAvailableWords(
        words,
        "easy",
        new Set(),
        mastered,
        "all",
      );
      expect(result.availableWords).toHaveLength(0);

      randomSpy.mockRestore();
    });

    it("shouldResetUsed is true when no words available", () => {
      const used = new Set(["cat", "dog", "apple"]);
      const result = getAvailableWords(words, "all", used, new Set(), "all");
      expect(result.shouldResetUsed).toBe(true);
    });

    it("matches grade level", () => {
      const result = getAvailableWords(words, "all", new Set(), new Set(), "1");
      expect(result.availableWords).toHaveLength(3);
    });
  });

  describe("selectRandomWord", () => {
    it("returns null for empty array", () => {
      expect(selectRandomWord([])).toBeNull();
    });

    it("returns a word from the array", () => {
      const words: Word[] = [
        {
          word: "cat",
          definition: "A pet.",
          sentence: "The cat sat.",
          difficulty: "easy" as const,
          grade: 1,
        },
      ];
      expect(selectRandomWord(words)).toEqual(words[0]);
    });

    it("returns null for non-array input", () => {
      expect(selectRandomWord(null as any)).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// SoundManager tests
// ---------------------------------------------------------------------------

describe("SoundManager", () => {
  let soundManager: SoundManager;

  beforeEach(() => {
    soundManager = new SoundManager();
  });

  afterEach(() => {
    soundManager.cleanup();
  });

  describe("constructor", () => {
    it("sets isSupported to true when AudioContext is available", () => {
      expect(soundManager.isSupported).toBe(true);
    });
  });

  describe("play", () => {
    it("does not throw for valid sound kind", () => {
      expect(() => soundManager.play("correct")).not.toThrow();
    });

    it("does not throw for unknown sound kind", () => {
      expect(() => soundManager.play("unknown")).not.toThrow();
    });

    it("plays with default volume", () => {
      expect(() => soundManager.play("correct", 0.2)).not.toThrow();
    });
  });

  describe("SOUND_FREQUENCIES", () => {
    it("has correct, incorrect, and streak sounds", () => {
      expect(SOUND_FREQUENCIES.correct).toBeDefined();
      expect(SOUND_FREQUENCIES.incorrect).toBeDefined();
      expect(SOUND_FREQUENCIES.streak).toBeDefined();
    });

    it("correct has 3 notes", () => {
      expect(SOUND_FREQUENCIES.correct).toHaveLength(3);
    });

    it("incorrect has 3 notes", () => {
      expect(SOUND_FREQUENCIES.incorrect).toHaveLength(3);
    });

    it("streak has 4 notes", () => {
      expect(SOUND_FREQUENCIES.streak).toHaveLength(4);
    });
  });

  describe("stopAll", () => {
    it("does not throw", () => {
      expect(() => soundManager.stopAll()).not.toThrow();
    });
  });

  describe("cleanup", () => {
    it("does not throw", () => {
      expect(() => soundManager.cleanup()).not.toThrow();
    });
  });
});
