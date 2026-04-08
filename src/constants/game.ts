/**
 * Game logic and scoring constants.
 * Extracted from useGameStore.ts and GameBoard.tsx.
 */

/**
 * Streak milestones that trigger special celebration messages.
 */
export const STREAK_MILESTONES: readonly number[] = [5, 10, 15, 20];

/**
 * Base points awarded per correct answer, multiplied by streak count.
 */
export const POINTS_PER_STREAK = 10;

/**
 * Number of recent rounds kept for difficulty evolution tracking.
 */
export const RECENT_PERFORMANCE_WINDOW = 10;

/**
 * LocalStorage key for offline user ID.
 */
export const OFFLINE_UID_KEY = "real-bee-offline-uid";

/**
 * Delay in ms before transitioning to the next word after an answer.
 */
export const FEEDBACK_DELAY_MS = 2000;

/**
 * Duration of a single round in ms (30 seconds).
 */
export const ROUND_DURATION_MS = 30_000;

/**
 * Confetti celebration configuration for correct answers.
 */
export const CONFETTI_CONFIG = {
  particleCount: 40,
  spread: 60,
  startVelocity: 25,
  origin: { y: 0.6 },
  colors: ["#f97316", "#fbbf24", "#34d399", "#60a5fa"],
  disableForReducedMotion: true,
} as const;

/**
 * Voice recognition timeout durations mapped to user setting.
 */
export const VOICE_TIMEOUT_MS: Record<string, number> = {
  normal: 10_000,
  longer: 15_000,
  off: 60_000,
} as const;

/**
 * Minimum syllable count fallback when syllables are not provided.
 */
export const DEFAULT_SYLLABLE_COUNT = 1;

/**
 * Maximum hints available per word.
 */
export const MAX_HINTS_PER_WORD = 4;

/**
 * Number of recent host messages to display in the transcript.
 */
export const VISIBLE_MESSAGE_COUNT = 3;
