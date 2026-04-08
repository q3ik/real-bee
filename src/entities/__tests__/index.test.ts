import { describe, it, expect } from "vitest";
import {
  createWord,
  blankWordInSentence,
  createWordProgress,
  recordAttempt,
  createGameSession,
  closeGameSession,
  createGameResult,
} from "../";

describe("Entity factories", () => {
  describe("createWord", () => {
    it("creates a word with required fields and defaults", () => {
      const word = createWord({
        word: "cat",
        definition: "A small furry animal.",
        sentence: "The cat sat on the mat.",
      });

      expect(word.word).toBe("cat");
      expect(word.difficulty).toBe("easy");
      expect(word.grade).toBe(1);
    });

    it("accepts optional fields", () => {
      const word = createWord({
        word: "elephant",
        definition: "A large animal.",
        sentence: "The elephant walked.",
        partOfSpeech: "noun",
        syllables: "el-e-phant",
      });

      expect(word.partOfSpeech).toBe("noun");
      expect(word.syllables).toBe("el-e-phant");
    });
  });

  describe("blankWordInSentence", () => {
    it("replaces the word with blanks in the sentence", () => {
      const word = createWord({
        word: "cat",
        definition: "A small furry animal.",
        sentence: "The cat sat on the mat.",
      });

      expect(blankWordInSentence(word)).toBe("The _____ sat on the mat.");
    });
  });

  describe("createWordProgress", () => {
    it("creates fresh progress for a word", () => {
      const progress = createWordProgress("cat");

      expect(progress.word).toBe("cat");
      expect(progress.correctCount).toBe(0);
      expect(progress.attemptCount).toBe(0);
      expect(progress.mastered).toBe(false);
    });
  });

  describe("recordAttempt", () => {
    it("increments attempt count on correct answer", () => {
      const progress = createWordProgress("cat");
      const updated = recordAttempt(progress, true);

      expect(updated.attemptCount).toBe(1);
      expect(updated.correctCount).toBe(1);
      expect(updated.lastAttemptedAt).toBeTruthy();
    });

    it("increments attempt count on wrong answer", () => {
      const progress = createWordProgress("cat");
      const updated = recordAttempt(progress, false);

      expect(updated.attemptCount).toBe(1);
      expect(updated.correctCount).toBe(0);
    });

    it("marks word as mastered after 3 correct attempts", () => {
      let progress = createWordProgress("cat");
      progress = recordAttempt(progress, true);
      progress = recordAttempt(progress, true);
      progress = recordAttempt(progress, true);

      expect(progress.mastered).toBe(true);
    });
  });

  describe("createGameSession", () => {
    it("creates a new session with defaults", () => {
      const session = createGameSession("user-123");

      expect(session.uid).toBe("user-123");
      expect(session.startTime).toBeTruthy();
      expect(session.score).toBe(0);
      expect(session.synced).toBe(false);
    });
  });

  describe("closeGameSession", () => {
    it("sets endTime and accepts overrides", () => {
      const session = createGameSession("user-123");
      const closed = closeGameSession(session, { score: 150 });

      expect(closed.endTime).toBeTruthy();
      expect(closed.score).toBe(150);
    });
  });

  describe("createGameResult", () => {
    it("creates a result with normalized input", () => {
      const result = createGameResult({
        isCorrect: true,
        points: 10,
        newScore: 10,
        newStreak: 1,
        newBestStreak: 1,
        feedback: "Correct!",
        targetWord: "cat",
        rawInput: "c a t",
        isVoice: true,
      });

      expect(result.normalizedInput).toBe("cat");
    });
  });
});
