/**
 * useGamePhaseClasses — maps RoundPhase values to state-driven CSS class names.
 *
 * SUB-16 AC: "PHASE_CLASSES map covers all RoundPhase values; exhaustiveness
 * enforced by TypeScript — any missing key is a compile error."
 *
 * Exported as both a plain constant (for static use) and a hook wrapper
 * (for reactive use inside components via useGameStore).
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
 */
export const PHASE_CLASSES: Record<RoundPhase, string> = {
  "idle":           "",
  "word-announced": "state-word-announced",
  "listening":      "state-listening",
  "evaluating":     "state-evaluating",
  "correct":        "state-correct",
  "incorrect":      "state-incorrect",
  "hint-shown":     "state-hint-shown",
  "round-complete": "state-round-complete",
};

/**
 * React hook that returns the CSS class string for the current RoundPhase.
 *
 * Falls back to empty string for unknown phases (satisfies the `never` branch
 * if the FSM grows new states before this map is updated — production-safe).
 */
export function useGamePhaseClasses(): string {
  // roundPhase is only available on the orchestrator hook (useGameState), not
  // useGameStore. Until useGameState is wired everywhere, we read the top-level
  // GamePhase from the store and map it best-effort.
  const phase = useGameStore((s) => s.phase);

  // Map GamePhase → representative RoundPhase for CSS
  const roundPhaseApproximation: RoundPhase =
    phase === "playing"
      ? "listening"
      : phase === "round_end"
        ? "round-complete"
        : "idle";

  return PHASE_CLASSES[roundPhaseApproximation] ?? "";
}
