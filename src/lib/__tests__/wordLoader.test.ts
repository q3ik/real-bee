import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mapRawWord,
  parseGrade,
  normalizeDifficulty,
  clearWordCache,
  isGradeLoaded,
} from "../wordLoader";

describe("wordLoader", () => {
  beforeEach(() => {
    clearWordCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("mapRawWord", () => {
    it("maps raw JSON word to Word type", () => {
      const raw = {
        word: "elephant",
        definition: "A large animal.",
        example: "The elephant walked.",
        phonetic: "EL-e-phant",
        syllables: "el-e-phant",
        difficulty: "medium",
        gradeLevel: "3-5",
      };

      const result = mapRawWord(raw);

      expect(result.word).toBe("elephant");
      expect(result.definition).toBe("A large animal.");
      expect(result.sentence).toBe("The elephant walked.");
      expect(result.syllables).toBe("el-e-phant");
      expect(result.grade).toBe(3);
      expect(result.difficulty).toBe("medium");
    });
  });

  describe("parseGrade", () => {
    it("maps K-2 to grade 1", () => {
      expect(parseGrade("K-2")).toBe(1);
    });

    it("maps 3-5 to grade 3", () => {
      expect(parseGrade("3-5")).toBe(3);
    });

    it("maps 6-8 to grade 6", () => {
      expect(parseGrade("6-8")).toBe(6);
    });

    it("maps all to grade 0", () => {
      expect(parseGrade("all")).toBe(0);
    });

    it("maps single grade numbers correctly", () => {
      expect(parseGrade("1")).toBe(1);
      expect(parseGrade("4")).toBe(3);
      expect(parseGrade("7")).toBe(6);
    });
  });

  describe("normalizeDifficulty", () => {
    it("returns easy for easy", () => {
      expect(normalizeDifficulty("easy")).toBe("easy");
    });

    it("returns medium for medium", () => {
      expect(normalizeDifficulty("medium")).toBe("medium");
    });

    it("returns hard for hard", () => {
      expect(normalizeDifficulty("hard")).toBe("hard");
    });

    it("returns all for all", () => {
      expect(normalizeDifficulty("all")).toBe("all");
    });

    it("defaults to medium for unknown values", () => {
      expect(normalizeDifficulty("unknown")).toBe("medium");
    });

    it("handles case insensitivity", () => {
      expect(normalizeDifficulty("EASY")).toBe("easy");
    });
  });

  describe("cache", () => {
    it("clearWordCache resets cache", () => {
      clearWordCache();
      expect(isGradeLoaded(1)).toBe(false);
      expect(isGradeLoaded(0)).toBe(false);
    });
  });
});
