import { describe, it, expectTypeOf } from 'vitest';
import type { Word, WordProgress, GameSession, Grade } from '../index';

/**
 * SUB-01 AC: Unit tests that construct valid objects and assert they satisfy
 * each interface using the `satisfies` operator (compile-time) plus runtime
 * field checks via expectTypeOf.
 */
describe('Core domain types', () => {
  describe('Word', () => {
    it('accepts a minimal valid Word object', () => {
      const w = {
        word: 'elephant',
        definition: 'A large animal with a trunk.',
        sentence: 'The elephant walked to the watering hole.',
        grade: 3,
        difficulty: 'medium',
      } satisfies Word;

      expectTypeOf(w).toMatchTypeOf<Word>();
    });

    it('accepts a full Word object including optional fields', () => {
      const w = {
        word: 'acrobat',
        definition: 'A person who performs gymnastic feats.',
        sentence: 'The acrobat flipped through the air.',
        grade: 6,
        difficulty: 'hard',
        partOfSpeech: 'noun',
        usageExample: 'She trained as an acrobat.',
        syllables: 'ac-ro-bat',
      } satisfies Word;

      expectTypeOf(w).toMatchTypeOf<Word>();
    });

    it('Grade alias resolves to the same type as Word["grade"]', () => {
      expectTypeOf<Grade>().toEqualTypeOf<Word['grade']>();
    });
  });

  describe('WordProgress', () => {
    it('accepts a valid WordProgress object', () => {
      const wp = {
        word: 'elephant',
        correctCount: 5,
        attemptCount: 7,
        skipCount: 1,
        mastered: false,
        lastDifficulty: 'medium',
        lastAttemptedAt: '2026-04-10T14:00:00.000Z',
      } satisfies WordProgress;

      expectTypeOf(wp).toMatchTypeOf<WordProgress>();
    });

    it('mastered flag is a boolean', () => {
      const wp: WordProgress = {
        word: 'quiz',
        correctCount: 10,
        attemptCount: 10,
        skipCount: 0,
        mastered: true,
        lastDifficulty: 'easy',
        lastAttemptedAt: '2026-04-10T14:00:00.000Z',
      };

      expectTypeOf(wp.mastered).toBeBoolean();
    });
  });

  describe('GameSession', () => {
    it('accepts a valid GameSession object', () => {
      const gs = {
        id: 'sess-abc-123',
        uid: 'user-xyz-456',
        startTime: '2026-04-10T13:00:00.000Z',
        wordsSpelled: 10,
        correctCount: 8,
        difficultyEvolution: [1, 1, -1, 1, 1],
        score: 840,
        bestStreak: 5,
        synced: false,
      } satisfies GameSession;

      expectTypeOf(gs).toMatchTypeOf<GameSession>();
    });

    it('accepts a GameSession with optional endTime', () => {
      const gs = {
        id: 'sess-def-789',
        uid: 'user-abc-001',
        startTime: '2026-04-10T12:00:00.000Z',
        endTime: '2026-04-10T12:15:00.000Z',
        wordsSpelled: 20,
        correctCount: 18,
        difficultyEvolution: [],
        score: 1800,
        bestStreak: 12,
        synced: true,
      } satisfies GameSession;

      expectTypeOf(gs.endTime).toEqualTypeOf<string | undefined>();
    });

    it('difficultyEvolution is an array of numbers', () => {
      const gs: GameSession = {
        id: 'sess-ghi-000',
        uid: 'offline',
        startTime: '2026-04-10T11:00:00.000Z',
        wordsSpelled: 5,
        correctCount: 3,
        difficultyEvolution: [1, -1, 1],
        score: 300,
        bestStreak: 2,
        synced: false,
      };

      expectTypeOf(gs.difficultyEvolution).toEqualTypeOf<number[]>();
    });
  });
});
