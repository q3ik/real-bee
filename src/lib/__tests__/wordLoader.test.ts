import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  clearWordCache,
  isGradeLoaded,
  getCachedGrades,
  loadWordsForGrade,
  getWordsForConfigAsync,
  GRADE_FILE_MAP,
  VALID_GRADES,
  WordLoaderError,
} from "../wordLoader";
import type { Word } from "@/types";

// ---------------------------------------------------------------------------
// Shared fixture - now in Word[] format (flat array, not wrapped)
// ---------------------------------------------------------------------------

const GRADE_1_WORDS: Word[] = [
  {
    word: "apple",
    definition: "A round fruit.",
    sentence: "She ate an apple.",
    grade: 1,
    difficulty: "easy",
    syllables: "ap-ple",
  },
  {
    word: "book",
    definition: "A written work.",
    sentence: "He read a book.",
    grade: 1,
    difficulty: "easy",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchOk(payload: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    } as Response),
  );
}

function mockFetchFail(status = 404): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.reject(new Error("not json")),
    } as unknown as Response),
  );
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("wordLoader", () => {
  beforeEach(() => {
    clearWordCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // VALID_GRADES
  // -------------------------------------------------------------------------

  describe("VALID_GRADES", () => {
    it("contains exactly all twelve grade buckets", () => {
      expect([...VALID_GRADES]).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // Cache utilities
  // -------------------------------------------------------------------------

  describe("cache utilities", () => {
    it("clearWordCache resets cache", () => {
      clearWordCache();
      expect(isGradeLoaded(1)).toBe(false);
      expect(isGradeLoaded(0)).toBe(false);
    });

    it("getCachedGrades returns empty array on cold cache", () => {
      expect(getCachedGrades()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // loadWordsForGrade
  // -------------------------------------------------------------------------

  describe("loadWordsForGrade", () => {
    it("successful load: returns Word[] from fetch", async () => {
      mockFetchOk(GRADE_1_WORDS);

      const words = await loadWordsForGrade(1);

      expect(words).toHaveLength(2);
      expect(words[0].word).toBe("apple");
      expect(words[0].grade).toBe(1);
      expect(words[1].word).toBe("book");
    });

    it("cache hit: second call for same grade does not re-fetch", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(GRADE_1_WORDS),
      } as Response);
      vi.stubGlobal("fetch", fetchMock);

      await loadWordsForGrade(1);
      await loadWordsForGrade(1); // second call — must hit cache

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(isGradeLoaded(1)).toBe(true);
      expect(getCachedGrades()).toContain(1);
    });

    it("getCachedGrades reflects loaded grades after successful fetch", async () => {
      mockFetchOk(GRADE_1_WORDS);

      await loadWordsForGrade(1);

      expect(getCachedGrades()).toEqual([1]);
    });

    it("fetch failure: rejects with WordLoaderError describing the file and status", async () => {
      mockFetchFail(503);

      await expect(loadWordsForGrade(3)).rejects.toThrow(WordLoaderError);
      await expect(loadWordsForGrade(3)).rejects.toThrow(/grade-3\.json.*503/);
    });

    it("invalid grade: throws WordLoaderError when no file is configured", async () => {
      // Grade 99 has no entry in GRADE_FILE_MAP
      // Stub fetch so it would succeed if reached — the guard must fire first
      mockFetchOk(GRADE_1_WORDS);

      await expect(loadWordsForGrade(99)).rejects.toThrow(WordLoaderError);
      await expect(loadWordsForGrade(99)).rejects.toThrow(
        /No word file configured for grade 99/,
      );
    });

    it("cache-clear refetch: after clearWordCache, reload re-fetches data", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(GRADE_1_WORDS),
      } as Response);
      vi.stubGlobal("fetch", fetchMock);

      // First load
      const words1 = await loadWordsForGrade(1);
      expect(words1).toHaveLength(2);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Clear cache
      clearWordCache();
      expect(isGradeLoaded(1)).toBe(false);

      // Second load should re-fetch
      const words2 = await loadWordsForGrade(1);
      expect(words2).toHaveLength(2);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Verify data is the same
      expect(words2[0].word).toBe(words1[0].word);
      expect(words2[1].word).toBe(words1[1].word);
    });
  });

  // -------------------------------------------------------------------------
  // getWordsForConfigAsync
  // -------------------------------------------------------------------------

  describe("getWordsForConfigAsync", () => {
    it("loads words from the correct grade file and filters by difficulty", async () => {
      const grade3Words: Word[] = [
        {
          word: "elephant",
          definition: "A large animal with a trunk.",
          sentence: "The elephant walked.",
          grade: 3,
          difficulty: "easy",
        },
        {
          word: "mountain",
          definition: "A very high hill.",
          sentence: "We climbed the mountain.",
          grade: 3,
          difficulty: "hard",
        },
        {
          word: "garden",
          definition: "A place where plants grow.",
          sentence: "She planted flowers in the garden.",
          grade: 3,
          difficulty: "easy",
        },
      ];

      mockFetchOk(grade3Words);

      const words = await getWordsForConfigAsync(3, "easy");

      expect(words).toHaveLength(2);
      expect(words.map((w) => w.word)).toEqual(["elephant", "garden"]);
      expect(words.every((w) => w.difficulty === "easy")).toBe(true);
    });

    it("returns all words when difficulty is 'all'", async () => {
      const grade5Words: Word[] = [
        {
          word: "adventure",
          definition: "An exciting experience.",
          sentence: "The trip was an adventure.",
          grade: 5,
          difficulty: "medium",
        },
        {
          word: "brilliant",
          definition: "Very bright or clever.",
          sentence: "She gave a brilliant performance.",
          grade: 5,
          difficulty: "hard",
        },
      ];

      mockFetchOk(grade5Words);

      const words = await getWordsForConfigAsync(5, "all");

      expect(words).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Integration: grade-specific file mapping
  // -------------------------------------------------------------------------

  describe("integration: grade-specific file mapping", () => {
    it("grade 3 loads from grade-3.json", async () => {
      const grade3Words: Word[] = [
        {
          word: "elephant",
          definition: "A large animal.",
          sentence: "The elephant is big.",
          grade: 3,
          difficulty: "easy",
        },
      ];

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(grade3Words),
      } as Response);
      vi.stubGlobal("fetch", fetchMock);

      const words = await loadWordsForGrade(3);

      expect(fetchMock).toHaveBeenCalledWith(
        "/data/words/grade-3.json",
        expect.objectContaining({}),
      );
      expect(words).toHaveLength(1);
      expect(words[0].word).toBe("elephant");
    });

    it("grade 0 loads all grade files (1-12) in parallel", async () => {
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        // Extract grade from URL like /data/words/grade-N.json
        const match = url.match(/grade-(\d+)\.json/);
        if (match) {
          const grade = parseInt(match[1], 10);
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  word: `word-grade${grade}`,
                  definition: `A word from grade ${grade}`,
                  sentence: `Sentence for grade ${grade}`,
                  grade,
                  difficulty: "easy" as const,
                },
              ]),
          } as Response);
        }
        return Promise.reject(new Error("Unknown file"));
      });
      vi.stubGlobal("fetch", fetchMock);

      const words = await loadWordsForGrade(0);

      // Should have loaded all 12 grade files
      expect(fetchMock).toHaveBeenCalledTimes(12);
      // Each grade should contribute 1 word
      expect(words).toHaveLength(12);
      // Verify all grades are represented
      const grades = words.map((w) => w.grade);
      for (const g of VALID_GRADES) {
        expect(grades).toContain(g);
      }
    });

    it("fetch is called with the correct URL for each grade", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);
      vi.stubGlobal("fetch", fetchMock);

      // Test a sampling of grades
      const testGrades = [1, 3, 6, 9, 12];
      for (const grade of testGrades) {
        clearWordCache();
        await loadWordsForGrade(grade);
        expect(fetchMock).toHaveBeenCalledWith(
          `/data/words/${GRADE_FILE_MAP[grade]}.json`,
          expect.objectContaining({}),
        );
      }
    });

    it("no any types in loaded words: all Word fields are properly typed", async () => {
      const grade1Words: Word[] = [
        {
          word: "apple",
          definition: "A fruit.",
          sentence: "I ate an apple.",
          grade: 1,
          difficulty: "easy",
          syllables: "ap-ple",
        },
      ];

      mockFetchOk(grade1Words);

      const words = await loadWordsForGrade(1);

      // Verify all required Word fields are present and typed correctly
      expect(words[0]).toHaveProperty("word", "apple");
      expect(words[0]).toHaveProperty("definition", "A fruit.");
      expect(words[0]).toHaveProperty("sentence", "I ate an apple.");
      expect(words[0]).toHaveProperty("grade", 1);
      expect(words[0]).toHaveProperty("difficulty", "easy");
      expect(typeof words[0].word).toBe("string");
      expect(typeof words[0].definition).toBe("string");
      expect(typeof words[0].sentence).toBe("string");
      expect(typeof words[0].grade).toBe("number");
      expect(typeof words[0].difficulty).toBe("string");
    });
  });
});
