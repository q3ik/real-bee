/**
 * useGamePhaseClasses — maps game store state to state-driven CSS class names.
 *
 * SUB-16 AC: "PHASE_CLASSES map covers all RoundPhase values; exhaustiveness
 * enforced by TypeScript — any missing key is a compile error."
 *
 * ## Implementation approach
 *
 * `useGameStore` exposes:
 *   - `phase: GamePhase` — coarse FSM state (idle | playing | round_end)
 *   - `result: GameResult | null` — set to non-null once a round ends;
 *     `result.isCorrect` distinguishes correct vs incorrect
 *
 * We derive the representative `RoundPhase` from these two values so the hook
 * can return the full range of CSS classes including `state-correct`,
 * `state-incorrect`, and `state-evaluating` — not just `state-listening`.
 *
 * When `useGameState().roundPhase` is wired application-wide (future work),
 * this hook can be simplified to a direct PHASE_CLASSES lookup.
 *
 * Usage in a component:
 * ```tsx
 * import { useGamePhaseClasses } from '../hooks/useGamePhaseClasses';
 *
 * function GameRoot() {
 *   const phaseClass = useGamePhaseClasses();
 *   return <main className={phaseClass}>...</main>;
 * }
 * ```
 */

import { useGameStore } from "./useGameStore";
import type { RoundPhase } from "./useGameState.types";

/**
 * Exhaustive map from every RoundPhase value to its corresponding CSS class.
 *
 * TypeScript enforces completeness: if a new value is added to RoundPhase
 * without updating this map, the compiler will error here — not silently at
 * runtime.
 *
 * Phases without a dedicated CSS class (`idle`, `word-announced`,
 * `hint-shown`, `round-complete`) intentionally map to empty string —
 * these states either have no visual override or inherit their styling
 * from a parent/sibling class.
 */
export const PHASE_CLASSES: Record<RoundPhase, string> = {
  "idle":           "",
  "word-announced": "",
  "listening":      "state-listening",
  "evaluating":     "state-evaluating",
  "correct":        "state-correct",
  "incorrect":      "state-incorrect",
  "hint-shown":     "",
  "round-complete": "",
};

/**
 * React hook that returns the CSS class string for the current game phase.
 *
 * Derives a `RoundPhase` representative from the store's coarse `GamePhase`
 * and `result.isCorrect` so that `state-correct` and `state-incorrect` are
 * reachable without requiring `useGameState().roundPhase` to be wired
 * application-wide.
 *
 * Mapping:
 *   - `idle`                              → "" (no class)
 *   - `playing`                           → "state-listening"
 *   - `round_end` + result null           → "state-evaluating" (transitional)
 *   - `round_end` + result.isCorrect      → "state-correct"
 *   - `round_end` + !result.isCorrect     → "state-incorrect"
 */
export function useGamePhaseClasses(): string {
  const phase = useGameStore((s) => s.phase);
  const result = useGameStore((s) => s.result);

  let roundPhase: RoundPhase;

  if (phase === "playing") {
    roundPhase = "listening";
  } else if (phase === "round_end") {
    if (result === null) {
      // result is set synchronously in submitAnswer, but guard defensively
      roundPhase = "evaluating";
    } else {
      roundPhase = result.isCorrect ? "correct" : "incorrect";
    }
  } else {
    roundPhase = "idle";
  }

  return PHASE_CLASSES[roundPhase] ?? "";
}
