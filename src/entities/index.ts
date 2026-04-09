/**
 * Entity factories for creating and transforming domain objects.
 * Provides pure functions for constructing typed entities with defaults.
 */

import type { Word, WordProgress, GameSession, GameResult } from "../types";

// ---------------------------------------------------------------------------
// Word
// ---------------------------------------------------------------------------

/**
 * Create a Word with sensible defaults.
 */
export function createWord(
  partial: Pick<Word, "word" | "definition" | "sentence"> & Partial<Word>,
): Word {
  return {
    word: partial.word,
    definition: partial.definition,
    sentence: partial.sentence,
    grade: partial.grade ?? 1,
    difficulty: partial.difficulty ?? "easy",
    partOfSpeech: partial.partOfSpeech,
    usageExample: partial.usageExample,
    syllables: partial.syllables,
  };
}

/**
 * Escape regex metacharacters so the word is treated as a literal string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Create a sentence with the target word blanked out for hint display.
 * Uses whole-word boundary matching and escapes regex metacharacters.
 */
export function blankWordInSentence(word: Word): string {
  const escaped = escapeRegex(word.word);
  return word.sentence.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "_____");
}

// ---------------------------------------------------------------------------
// WordProgress
// ---------------------------------------------------------------------------

/**
 * Create a fresh WordProgress for a new word.
 */
export function createWordProgress(word: string): WordProgress {
  return {
    word,
    correctCount: 0,
    attemptCount: 0,
    skipCount: 0,
    mastered: false,
    lastDifficulty: "easy",
    lastAttemptedAt: "",
  };
}

/**
 * Record a spelling attempt on an existing WordProgress.
 */
export function recordAttempt(
  progress: WordProgress,
  isCorrect: boolean,
): WordProgress {
  const newCorrectCount = progress.correctCount + (isCorrect ? 1 : 0);
  return {
    ...progress,
    correctCount: newCorrectCount,
    attemptCount: progress.attemptCount + 1,
    mastered: newCorrectCount >= 3, // 3 correct = mastered
    lastAttemptedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// GameSession
// ---------------------------------------------------------------------------

/**
 * Create a new game session.
 */
export function createGameSession(uid: string): GameSession {
  return {
    id: crypto.randomUUID(),
    uid,
    startTime: new Date().toISOString(),
    wordsSpelled: 0,
    correctCount: 0,
    difficultyEvolution: [],
    score: 0,
    bestStreak: 0,
    synced: false,
  };
}

/**
 * Close a game session with final stats.
 */
export function closeGameSession(
  session: GameSession,
  overrides?: Partial<GameSession>,
): GameSession {
  return {
    ...session,
    endTime: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// GameResult
// ---------------------------------------------------------------------------

/**
 * Create a GameResult from a submission outcome.
 */
export function createGameResult(params: {
  isCorrect: boolean;
  points: number;
  newScore: number;
  newStreak: number;
  newBestStreak: number;
  feedback: string;
  targetWord: string;
  rawInput: string;
  isVoice: boolean;
}): GameResult {
  return {
    ...params,
    normalizedInput: params.rawInput.toLowerCase().replace(/\s/g, ""),
  };
}
