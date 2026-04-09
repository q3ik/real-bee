/**
 * Core domain types for the Real Bee spelling bee game.
 * Centralized type definitions to eliminate scattered inline types.
 */

// ---------------------------------------------------------------------------
// Word & Learning
// ---------------------------------------------------------------------------

/**
 * Difficulty levels for words and game configuration.
 */
export type GameDifficulty = 'easy' | 'medium' | 'hard' | 'all';

/**
 * A single word in the spelling bee word bank.
 */
export interface Word {
  /** The word text (e.g., "elephant") */
  word: string;
  /** A child-friendly definition */
  definition: string;
  /** A sentence using the word (target word replaced with _____ for hints) */
  sentence: string;
  /** Grade level: 1 (K-2), 3 (3-5), 6 (6-8), 9 (9-12), 0 (all grades) */
  grade: number;
  /** Word difficulty tier */
  difficulty: GameDifficulty;
  /** Part of speech (e.g., "noun", "verb") */
  partOfSpeech?: string;
  /** Usage example (alternative sentence) */
  usageExample?: string;
  /** Syllable breakdown (hyphen-separated, e.g., "el-e-phant") */
  syllables?: string;
}

/**
 * Tracking data for a single word's mastery progress.
 */
export interface WordProgress {
  /** The word text */
  word: string;
  /** Number of times spelled correctly */
  correctCount: number;
  /** Number of times attempted */
  attemptCount: number;
  /** Number of times skipped */
  skipCount: number;
  /** Whether the word is marked as mastered */
  mastered: boolean;
  /** Difficulty tier when last attempted */
  lastDifficulty: GameDifficulty;
  /** Timestamp of last attempt (ISO 8601) */
  lastAttemptedAt: string;
}

// ---------------------------------------------------------------------------
// Game Session
// ---------------------------------------------------------------------------

/**
 * Phase of the game finite state machine.
 */
export type GamePhase = 'idle' | 'playing' | 'round_end';

/**
 * Result of a single spelling submission.
 */
export interface GameResult {
  isCorrect: boolean;
  points: number;
  newScore: number;
  newStreak: number;
  newBestStreak: number;
  feedback: string;
  targetWord: string;
  rawInput: string;
  normalizedInput: string;
  isVoice: boolean;
}

/**
 * Displayable session statistic.
 */
export interface SessionStat {
  label: string;
  value: string | number;
}

/**
 * Snapshot of a completed or in-progress game session.
 */
export interface GameSession {
  /** Unique session identifier */
  id: string;
  /** User ID (Supabase UID or offline UID) */
  uid: string;
  /** Session start time (ISO 8601) */
  startTime: string;
  /** Session end time (ISO 8601) — empty if still active */
  endTime?: string;
  /** Total words attempted */
  wordsSpelled: number;
  /** Correct answers */
  correctCount: number;
  /** Array of 1 (correct) / -1 (incorrect) for difficulty evolution tracking */
  difficultyEvolution: number[];
  /** Final score */
  score: number;
  /** Best streak achieved */
  bestStreak: number;
  /** Whether this session has been synced to the cloud */
  synced: boolean;
}

// ---------------------------------------------------------------------------
// User & Preferences
// ---------------------------------------------------------------------------

/**
 * Difficulty selector for user-facing settings UI.
 */
export type PreferenceDifficulty = 'easy' | 'medium' | 'hard' | 'all';

/**
 * Grade level selector for user-facing settings UI.
 * Variants mirror the range-based grade buckets in wordLoader VALID_GRADES:
 *   'K-2'  → grade 1, '3-5' → grade 3, '6-8' → grade 6,
 *   '9-12' → grade 9, 'all' → grade 0
 */
export type GradeLevel = 'K-2' | '3-5' | '6-8' | '9-12' | 'all';

/**
 * Voice synthesis quality option.
 */
export type VoiceQuality = 'natural' | 'standard';

/**
 * Listening timeout duration option.
 */
export type ListeningTimeout = 'normal' | 'longer' | 'off';
