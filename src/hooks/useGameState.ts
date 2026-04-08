/**
 * useGameState — FSM selector facade over useGameStore.
 *
 * The real-bee game FSM lives inside the Zustand store (useGameStore).
 * This hook exists to satisfy the Phase-1 port checklist and to give
 * consumers a focused, FSM-only API without exposing the full store.
 *
 * It is intentionally a thin selector — there is no duplicate state.
 * All transitions are delegated to the store actions.
 *
 * @example
 * ```tsx
 * function GameBoard() {
 *   const { phase, result, startSession, submitAnswer, nextWord } = useGameState();
 *
 *   if (phase === 'idle') return <StartScreen onStart={startSession} />;
 *   if (phase === 'round_end') return <ResultScreen result={result} onNext={nextWord} />;
 *   return <ActiveRound onSubmit={submitAnswer} />;
 * }
 * ```
 */

import { useGameStore } from './useGameStore';
import type { GamePhase, GameFSMEvent } from './useGameState.types';
import type { GameResult } from './useGameStore';

// ---------------------------------------------------------------------------
// Return-type contract
// ---------------------------------------------------------------------------

export interface UseGameStateResult {
  /** Current FSM phase. */
  phase: GamePhase;

  /** Result of the most-recently completed round, or null if in idle/playing. */
  result: GameResult | null;

  // --- Transition actions (mirror GameFSMEvent union) ---

  /** Transition: idle → playing. Resets session stats and picks the first word. */
  startSession: () => void;

  /**
   * Transition: playing → round_end.
   * Evaluates the answer, updates score/streak, and sets the result.
   * Returns true if the answer was correct.
   */
  submitAnswer: (answer: string, isVoice?: boolean) => boolean;

  /** Transition: playing → round_end (timeout path). */
  timeoutRound: () => void;

  /** Transition: round_end → playing. Advances to the next word. */
  nextWord: () => void;

  /** Transition: any → idle. Full reset. */
  restartGame: () => void;

  /**
   * Escape hatch for setting phase directly when no dedicated action fits.
   * Prefer the named transition actions above when possible.
   */
  setPhase: (phase: GamePhase) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Exposes the game FSM phase, latest round result, and all FSM-transition
 * actions. Backed by useGameStore — no duplicate state is created.
 */
export function useGameState(): UseGameStateResult {
  const phase = useGameStore((s) => s.phase);
  const result = useGameStore((s) => s.result);
  const startSession = useGameStore((s) => s.startSession);
  const submitAnswer = useGameStore((s) => s.submitAnswer);
  const timeoutRound = useGameStore((s) => s.timeoutRound);
  const nextWord = useGameStore((s) => s.nextWord);
  const restartGame = useGameStore((s) => s.restartGame);
  const setPhase = useGameStore((s) => s.setPhase);

  return {
    phase,
    result,
    startSession,
    submitAnswer,
    timeoutRound,
    nextWord,
    restartGame,
    setPhase,
  };
}

// Re-export canonical FSM types so consumers can import from one place.
export type { GamePhase, GameFSMEvent } from './useGameState.types';
