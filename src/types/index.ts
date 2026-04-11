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
export type GameDifficulty = "easy" | "medium" | "hard" | "all";

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
  /** Grade level: 1 (K-2), 2 (K-2), 3 (3-5), 4 (3-5), 5 (3-5), 6 (6-8), 7 (6-8), 8 (6-8), 9 (9-12), 10 (9-12), 11 (9-12), 12 (9-12), 0 (all grades) */
  grade: Grade;
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
 * Valid grade values as a literal union for compile-time enforcement.
 * Mirrors the grade levels used in the word database (grades 1-12, plus 0 for all).
 */
export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 0;

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
export type GamePhase = "idle" | "playing" | "round_end";

/**
 * Result of a single spelling submission.
 */
export interface GameResult {
  /** Whether the submitted spelling was correct */
  isCorrect: boolean;
  /** Points awarded for this submission */
  points: number;
  /** Running total score after this submission */
  newScore: number;
  /** Current streak count after this submission */
  newStreak: number;
  /** Best streak achieved so far in the session */
  newBestStreak: number;
  /** Human-readable feedback message */
  feedback: string;
  /** The word that was being spelled */
  targetWord: string;
  /** Raw text/voice input as received */
  rawInput: string;
  /** Normalized (trimmed, lowercased) input used for comparison */
  normalizedInput: string;
  /** Whether the answer was submitted via voice recognition */
  isVoice: boolean;
}

/**
 * Result of a single game round.
 */
export interface GameRound {
  /** The word for this round */
  word: string;
  /** Whether the answer was correct */
  isCorrect: boolean;
  /** Points awarded */
  points: number;
  /** Streak after this round */
  streak: number;
  /** Time taken to answer (ms) */
  timeTaken?: number;
}

/**
 * Displayable session statistic.
 */
export interface SessionStat {
  /** Human-readable label (e.g., "Words Correct") */
  label: string;
  /** Formatted or raw value to display */
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
  /** Individual round results */
  rounds: GameRound[];
}

// ---------------------------------------------------------------------------
// User & Preferences
// ---------------------------------------------------------------------------

/**
 * Difficulty selector for user-facing settings UI.
 */
export type PreferenceDifficulty = "easy" | "medium" | "hard" | "all";

/**
 * Grade level selector for user-facing settings UI.
 * Variants mirror the range-based grade buckets in wordLoader VALID_GRADES:
 *   'K-2'  → grade 1, '3-5' → grade 3, '6-8' → grade 6,
 *   '9-12' → grade 9, 'all' → grade 0
 */
export type GradeLevel = "K-2" | "3-5" | "6-8" | "9-12" | "all";

/**
 * Voice synthesis quality option.
 */
export type VoiceQuality = "natural" | "standard";

/**
 * Listening timeout duration option.
 */
export type ListeningTimeout = "normal" | "longer" | "off";
