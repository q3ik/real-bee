/**
 * Canonical FSM type definitions for the real-bee game state machine.
 *
 * This is the single source of truth for GamePhase and related FSM types.
 * All other hooks (useGameStore, useGameKeyboardShortcuts, etc.) should
 * import GamePhase from here.
 */

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
