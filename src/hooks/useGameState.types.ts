/**
 * Canonical FSM type definitions for the real-bee game state machine.
 *
 * This is the single source of truth for GamePhase and related FSM types.
 * All other hooks (useGameStore, useGameKeyboardShortcuts, etc.) should
 * import GamePhase from here.
 */

// ---------------------------------------------------------------------------
// Existing FSM types (do not modify — used throughout the codebase)
// ---------------------------------------------------------------------------

/**
 * All possible phases of the game FSM.
 *
 * - `idle`      — No active session; start screen or post-session summary.
 * - `playing`   — A round is in progress; countdown is running, input is accepted.
 * - `round_end` — The round has finished (correct answer, wrong answer, or timeout);
 *                 result overlay is visible before advancing to the next word.
 */
export type GamePhase = "idle" | "playing" | "round_end";

/**
 * Shape of a single FSM transition event.
 * Extend this union when new transitions are needed.
 */
export type GameFSMEvent =
  | { type: "START_SESSION" }
  | { type: "START_ROUND" }
  | { type: "SUBMIT_ANSWER"; payload: { answer: string; isVoice?: boolean } }
  | { type: "ROUND_END" }
  | { type: "TIMEOUT" }
  | { type: "NEXT_WORD" }
  | { type: "RESTART" };

/**
 * Valid FSM transition map — documents which events are legal per phase.
 * This is informational only (not enforced at runtime by Zustand directly),
 * but serves as a contract for contributors.
 *
 * idle      → START_SESSION  → playing
 * playing   → SUBMIT_ANSWER  → round_end
 * playing   → TIMEOUT        → round_end
 * round_end → NEXT_WORD      → playing
 * round_end → RESTART        → idle
 * *         → RESTART        → idle
 */
export type FSMTransitionMap = {
  idle: "START_SESSION";
  playing: "SUBMIT_ANSWER" | "TIMEOUT" | "ROUND_END";
  round_end: "NEXT_WORD" | "RESTART";
};

// ---------------------------------------------------------------------------
// Round-level lifecycle phases (finer-grained than GamePhase)
// ---------------------------------------------------------------------------

/**
 * Sub-phases within a single round's lifecycle.
 *
 * The round lifecycle flows as:
 *   idle → word-announced → listening → evaluating → correct | incorrect → round-complete
 *
 * A hint can be requested while in the `listening` phase, which transitions
 * to `hint-shown` and then returns to `listening`.
 */
export type RoundPhase =
  | "idle"
  | "word-announced"
  | "listening"
  | "evaluating"
  | "correct"
  | "incorrect"
  | "hint-shown"
  | "round-complete";

// ---------------------------------------------------------------------------
// Session-level game status
// ---------------------------------------------------------------------------

/**
 * High-level session status of the game.
 *
 * - `lobby`           — Player has not started a session yet.
 * - `active`          — A session is in progress (rounds are being played).
 * - `paused`          — Session is temporarily paused.
 * - `session-complete` — All rounds finished; final summary displayed.
 */
export type GameStatus = "lobby" | "active" | "paused" | "session-complete";

// ---------------------------------------------------------------------------
// Last answer record
// ---------------------------------------------------------------------------

/**
 * Details of the most recent answer submission.
 */
export interface LastAnswer {
  /** The raw input the player submitted */
  raw: string;
  /** The normalized (lowercased, trimmed) version used for comparison */
  normalized: string;
  /** Whether the submission came from voice recognition */
  isVoice: boolean;
  /** Whether the answer was correct */
  wasCorrect: boolean;
}

// ---------------------------------------------------------------------------
// GameStateContext — composite state for the orchestrator hook
// ---------------------------------------------------------------------------

/**
 * Composite context object passed to the orchestrator hook.
 * Groups inputs that drive game-side effects (TTS, messages, hints).
 */
export interface GameStateContext {
  /** Whether sound effects and TTS are enabled */
  soundEnabled: boolean;
  /** Whether TTS is supported in the current browser */
  ttsSupported: boolean;
  /** Maximum hints available per word */
  maxHints: number;
}

// ---------------------------------------------------------------------------
// UseGameStateReturn — expanded hook return type
// ---------------------------------------------------------------------------

/**
 * Return type for the expanded useGameState orchestrator hook.
 *
 * Combines:
 * - FSM phase and round-level lifecycle phase
 * - Session status (lobby / active / paused / session-complete)
 * - Current word, score, streak, and round metadata
 * - Hint tracking (hints array, hints remaining)
 * - Last answer record
 * - All transition actions (startSession, submitAnswer, nextWord, etc.)
 * - Session management (pause, resume, end)
 * - Hint request and word repeat helpers
 */
export interface UseGameStateReturn {
  // --- FSM state ---
  /** Current FSM phase (from useGameStore). */
  phase: GamePhase;
  /** Fine-grained round lifecycle phase. */
  roundPhase: RoundPhase;
  /** High-level session status. */
  gameStatus: GameStatus;
  /** Result of the most-recently completed round, or null. */
  result: import("./useGameStore").GameResult | null;

  // --- Gameplay state (mirrored from useGameStore) ---
  /** The word currently being spelled, or null. */
  currentWord: import("../lib/wordList").Word | null;
  /** Current score for the session. */
  score: number;
  /** Consecutive correct answer count. */
  streak: number;
  /** Best streak achieved in the session. */
  bestStreak: number;
  /** Total rounds attempted in the session. */
  roundsPlayed: number;
  /** Total correct answers in the session. */
  correctAnswers: number;
  /** Index of the current round within the session (0-based). */
  roundIndex: number;
  /** Total number of rounds configured for the session. */
  totalRounds: number;
  /** Number of hints still available for the current word. */
  hintsRemaining: number;
  /** Details of the most recent answer submission, or null. */
  lastAnswer: LastAnswer | null;
  /** Whether the last submitted answer was correct. */
  wasCorrect: boolean | null;
  /** Array of hints revealed for the current word. */
  hints: import("./useHints.types").Hint[];

  // --- FSM transitions ---
  /** Transition: idle → playing. Resets session stats and picks the first word. */
  startSession: () => void;
  /**
   * Transition: playing → round_end.
   * Returns true (correct), false (incorrect), or null (invalid/empty input).
   */
  submitAnswer: (answer: string, isVoice?: boolean) => boolean | null;
  /** Transition: playing → round_end (timeout path). */
  timeoutRound: () => void;
  /** Transition: round_end → playing. Advances to the next word. */
  nextWord: () => void;
  /** Transition: any → idle. Full reset. */
  restartGame: () => void;
  /** Escape hatch for setting phase directly. */
  setPhase: (phase: GamePhase) => void;

  // --- Session management ---
  /** Pause the current session (stops timers, blocks input). */
  pauseGame: () => void;
  /** Resume a paused session. */
  resumeGame: () => void;
  /** End the session, save to IndexedDB, and transition to session-complete. */
  endSession: () => Promise<void>;

  // --- Hint & TTS helpers ---
  /** Request a hint for the current word. Decrements hintsRemaining. */
  requestHint: () => void;
  /** Repeat the current word aloud via TTS. */
  repeatWord: () => Promise<void>;
}
