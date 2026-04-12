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
 * const { hints, requestHint, hintsRemaining } = useHints({ onSpeak: speak });
 *
 * // Reveal the next available hint for the current word:
 * const hint = requestHint(currentWord);
 * ```
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { getHint, getAvailableHints } from "../game-engine/hints";
import type { HintType as EngineHintType } from "../game-engine/hints";
import type { Hint, HintType, UseHintsResult, WordData } from "./useHints.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseHintsOptions {
  /**
   * Optional TTS callback. When provided, every newly revealed hint is spoken
   * aloud using this function immediately after it is added to state.
   * Satisfies AC item 5 from issue #34.
   *
   * Callers that pass `onSpeak` must NOT also manually call `speak()` after
   * `requestHint()` to avoid double-speaking.
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
  // Track the most recently revealed hint.
  const [lastHint, setLastHint] = useState<Hint | null>(null);

  /**
   * Core hint-reveal logic shared by both `requestHint` and the deprecated
   * `addHint` alias.
   *
   * Picks the next un-used hint in priority order, appends it to state,
   * speaks it via `onSpeak` if provided, and returns it.
   *
   * Returns `null` when no further hints are available.
   */
  const revealNextHint = useCallback(
    (wordData: WordData): Hint | null => {
      if (!wordData?.word) return null;

      // Build a minimal Word-compatible object from WordData.
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
      setLastHint(hint);
      usedTypesRef.current = [...usedTypesRef.current, hint.type];

      // Speak the hint aloud if a TTS callback was provided (AC item 5).
      // Callers that pass onSpeak must not also call speak() manually.
      if (onSpeak) {
        onSpeak(hint.spokenText ?? hint.text);
      }

      return hint;
    },
    [onSpeak],
  );

  /**
   * Reveal the next available hint for `wordData`.
   * Primary API — prefer this over the deprecated `addHint`.
   */
  const requestHint = useCallback(
    (wordData: WordData): Hint | null => revealNextHint(wordData),
    [revealNextHint],
  );

  /**
   * @deprecated Use `requestHint` instead.
   * Kept for backward compatibility with existing callers.
   */
  const addHint = useCallback(
    (wordData: WordData): Hint | null => revealNextHint(wordData),
    [revealNextHint],
  );

  /**
   * Clear all hints and reset type tracking.
   * Call this when starting a new word/round.
   */
  const clearHints = useCallback((): void => {
    setHints([]);
    setLastHint(null);
    usedTypesRef.current = [];
  }, []);

  /**
   * Reset type tracking without clearing visible hint history.
   * Call this when the word pool changes but you want to keep hints on screen.
   */
  const resetHintTracking = useCallback((): void => {
    usedTypesRef.current = [];
  }, []);

  /**
   * Derive available hint types for a given word.
   * NOTE: This is a snapshot based on the current usedTypesRef at render time.
   * Consumers must pass `wordData` to get a meaningful result.
   *
   * For per-render availability, use getAvailableHints() from game-engine directly.
   */
  const availableHints = useMemo<HintType[]>(() => [], []);

  return {
    hints,
    requestHint,
    addHint,
    availableHints,
    usedHints: usedTypesRef.current,
    hintsRemaining: 0, // Managed externally by useGameState (MAX_HINTS_PER_WORD - hints.length)
    lastHint,
    clearHints,
    resetHintTracking,
  };
}

// Re-export types for convenience
export type { HintType, Hint, WordData, UseHintsResult } from "./useHints.types";
