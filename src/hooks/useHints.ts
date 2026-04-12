/**
 * useHints — Manages hint state for the current word.
 *
 * Consumes `game-engine/hints.ts` for pure hint computation and adds:
 *  - React state for the accumulated hints list
 *  - Used-hint deduplication via a ref
 *  - Optional TTS callback so each hint is spoken aloud when revealed
 *
 * Usage:
 * ```tsx
 * const { hints, addHint, clearHints } = useHints({ onSpeak: speak });
 *
 * // Reveal the next available hint for the current word:
 * const hint = addHint(currentWord);
 * ```
 */

import { useCallback, useRef, useState } from "react";
import { getHint, getAvailableHints } from "../game-engine/hints";
import type { HintType as EngineHintType } from "../game-engine/hints";
import type { Hint, HintType, UseHintsResult, WordData } from "./useHints.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseHintsOptions {
  /**
   * Optional TTS callback. When provided, every newly revealed hint is spoken
   * aloud using this function. Satisfies AC item 5 from issue #34.
   */
  onSpeak?: (text: string) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manage hints for the current word.
 *
 * @param options.onSpeak - Optional TTS speak callback; hints are spoken when provided.
 */
export function useHints(options: UseHintsOptions = {}): UseHintsResult {
  const { onSpeak } = options;

  const [hints, setHints] = useState<Hint[]>([]);
  // Track used hint types in a ref to avoid stale closure issues.
  const usedTypesRef = useRef<HintType[]>([]);

  /**
   * Reveal the next available hint for `wordData`.
   *
   * Internally calls `getAvailableHints` from game-engine/hints.ts to pick
   * the next un-used hint in priority order, then appends it to state.
   * Speaks the hint via `onSpeak` if provided.
   *
   * Returns `null` when no further hints are available.
   */
  const addHint = useCallback(
    (wordData: WordData): Hint | null => {
      if (!wordData?.word) return null;

      // Build a minimal Word-compatible object from WordData.
      // We only need the fields game-engine/hints.ts reads.
      const wordForEngine = wordData as Parameters<typeof getHint>[0];

      const available = getAvailableHints(
        wordForEngine,
        usedTypesRef.current as EngineHintType[],
      );

      if (available.length === 0) return null;

      const nextType = available[0];
      const result = getHint(wordForEngine, nextType);
      if (!result) return null;

      const hint: Hint = {
        type: result.type as HintType,
        text: result.content,
        spokenText: result.content,
        costInPoints: result.costInPoints,
      };

      setHints((prev) => [...prev, hint]);
      usedTypesRef.current = [...usedTypesRef.current, hint.type];

      // Speak the hint aloud if a TTS callback was provided (AC item 5).
      if (onSpeak) {
        onSpeak(hint.spokenText ?? hint.text);
      }

      return hint;
    },
    [onSpeak],
  );

  /**
   * Clear all hints and reset type tracking.
   * Call this when starting a new word/round.
   */
  const clearHints = useCallback((): void => {
    setHints([]);
    usedTypesRef.current = [];
  }, []);

  /**
   * Reset type tracking without clearing visible hint history.
   * Call this when the word pool changes but you want to keep hints on screen.
   */
  const resetHintTracking = useCallback((): void => {
    usedTypesRef.current = [];
  }, []);

  return {
    hints,
    addHint,
    clearHints,
    resetHintTracking,
  };
}

// Re-export types for convenience
export type { HintType, Hint, WordData, UseHintsResult } from "./useHints.types";
