import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  clearWordCache,
  isGradeLoaded,
  getCachedGrades,
  loadWordsForGrade,
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
});
