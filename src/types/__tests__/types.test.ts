import { describe, it, expectTypeOf } from "vitest";
import type {
  Word,
  WordProgress,
  GameSession,
  GameRound,
  Grade,
} from "../index";

/**
 * SUB-01 AC: Unit tests that construct valid objects and assert they satisfy
 * each interface using the `satisfies` operator (compile-time) plus runtime
 * field checks via expectTypeOf.
 */
describe("Core domain types", () => {
  describe("Word", () => {
    it("accepts a minimal valid Word object", () => {
      const w = {
        word: "elephant",
        definition: "A large animal with a trunk.",
        sentence: "The elephant walked to the watering hole.",
        grade: 3,
        difficulty: "medium",
      } satisfies Word;

      expectTypeOf(w).toMatchTypeOf<Word>();
    });

    it("accepts a full Word object including optional fields", () => {
      const w = {
        word: "acrobat",
        definition: "A person who performs gymnastic feats.",
        sentence: "The acrobat flipped through the air.",
        grade: 6,
        difficulty: "hard",
        partOfSpeech: "noun",
        usageExample: "She trained as an acrobat.",
        syllables: "ac-ro-bat",
      } satisfies Word;

      expectTypeOf(w).toMatchTypeOf<Word>();
    });

    it('Grade alias resolves to the same type as Word["grade"]', () => {
      expectTypeOf<Grade>().toEqualTypeOf<Word["grade"]>();
    });
  });

  describe("WordProgress", () => {
    it("accepts a valid WordProgress object", () => {
      const wp = {
        word: "elephant",
        correctCount: 5,
        attemptCount: 7,
        skipCount: 1,
        mastered: false,
        lastDifficulty: "medium",
        lastAttemptedAt: "2026-04-10T14:00:00.000Z",
      } satisfies WordProgress;

      expectTypeOf(wp).toMatchTypeOf<WordProgress>();
    });

    it("mastered flag is a boolean", () => {
      const wp: WordProgress = {
        word: "quiz",
        correctCount: 10,
        attemptCount: 10,
        skipCount: 0,
        mastered: true,
        lastDifficulty: "easy",
        lastAttemptedAt: "2026-04-10T14:00:00.000Z",
      };

      expectTypeOf(wp.mastered).toBeBoolean();
    });
  });

  describe("GameSession", () => {
    it("accepts a valid GameSession object", () => {
      const gs = {
        id: "sess-abc-123",
        uid: "user-xyz-456",
        startTime: "2026-04-10T13:00:00.000Z",
        wordsSpelled: 10,
        correctCount: 8,
        difficultyEvolution: [1, 1, -1, 1, 1],
        score: 840,
        bestStreak: 5,
        synced: false,
        rounds: [],
      } satisfies GameSession;

      expectTypeOf(gs).toMatchTypeOf<GameSession>();
    });

    it("accepts a GameSession with optional endTime", () => {
      const gs = {
        id: "sess-def-789",
        uid: "user-abc-001",
        startTime: "2026-04-10T12:00:00.000Z",
        endTime: "2026-04-10T12:15:00.000Z",
        wordsSpelled: 20,
        correctCount: 18,
        difficultyEvolution: [],
        score: 1800,
        bestStreak: 12,
        synced: true,
        rounds: [],
      } satisfies GameSession;

      expectTypeOf(gs.endTime).toBeString();
    });

    it("difficultyEvolution is an array of numbers", () => {
      const gs: GameSession = {
        id: "sess-ghi-000",
        uid: "offline",
        startTime: "2026-04-10T11:00:00.000Z",
        wordsSpelled: 5,
        correctCount: 3,
        difficultyEvolution: [1, -1, 1],
        score: 300,
        bestStreak: 2,
        synced: false,
        rounds: [],
      };

      expectTypeOf(gs.difficultyEvolution).toEqualTypeOf<number[]>();
    });

    it("accepts GameRound objects in rounds array", () => {
      const round: GameRound = {
        word: "elephant",
        isCorrect: true,
        points: 100,
        streak: 3,
        timeTaken: 5200,
      };

      expectTypeOf(round).toMatchTypeOf<GameRound>();
      expectTypeOf(round.word).toBeString();
      expectTypeOf(round.isCorrect).toBeBoolean();
      expectTypeOf(round.points).toBeNumber();
      expectTypeOf(round.streak).toBeNumber();
      expectTypeOf(round.timeTaken).toEqualTypeOf<number | undefined>();
    });

    it("GameSession with populated rounds array", () => {
      const gs: GameSession = {
        id: "sess-rounds-001",
        uid: "user-test",
        startTime: "2026-04-10T10:00:00.000Z",
        endTime: "2026-04-10T10:10:00.000Z",
        wordsSpelled: 3,
        correctCount: 2,
        difficultyEvolution: [1, 1, -1],
        score: 250,
        bestStreak: 2,
        synced: false,
        rounds: [
          {
            word: "cat",
            isCorrect: true,
            points: 100,
            streak: 1,
            timeTaken: 3000,
          },
          {
            word: "dog",
            isCorrect: true,
            points: 150,
            streak: 2,
            timeTaken: 4500,
          },
          {
            word: "elephant",
            isCorrect: false,
            points: 0,
            streak: 0,
            timeTaken: 12000,
          },
        ],
      };

      expectTypeOf(gs.rounds).toEqualTypeOf<GameRound[]>();
      expectTypeOf(gs.rounds[0].word).toBeString();
    });
  });
});
