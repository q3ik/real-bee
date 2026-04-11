import { useCallback, useRef, useState } from "react";
import type {
  Hint,
  HintType,
  UseHintsResult,
  WordData,
} from "./useHints.types";

/**
 * Generate a hint based on word properties, avoiding previously used hint types.
 */
function generateHint(
  wordData: WordData | null | undefined,
  usedHints: HintType[] = [],
): Hint | null {
  if (!wordData?.word) return null;

  const word = wordData.word;
  const hints: Hint[] = [];

  const startsWithVowel = /^[aeiou]/i.test(word);
  hints.push({
    type: "vowel",
    text: startsWithVowel ? "Starts with a vowel" : "Starts with a consonant",
  });

  const hasDoubleLetter = /(.)\1/.test(word);
  if (hasDoubleLetter) {
    const match = word.match(/(.)\1/);
    if (match) {
      hints.push({
        type: "double",
        text: `Contains a double letter (${match[1].toUpperCase()})`,
      });
    }
  }

  hints.push({
    type: "length",
    text: `${word.length} letters long`,
  });

  hints.push({
    type: "first",
    text: `Starts with '${word[0].toUpperCase()}'`,
  });

  hints.push({
    type: "last",
    text: `Ends with '${word[word.length - 1].toUpperCase()}'`,
  });

  const syllableBreakdown =
    wordData.syllables && typeof wordData.syllables === "string"
      ? wordData.syllables
      : word.includes("-")
        ? word
        : null;

  const syllableCount = syllableBreakdown
    ? syllableBreakdown.split("-").length
    : 1;

  // Only reveal the count — the syllable breakdown (e.g. "cat-er-pil-lar")
  // would give away the spelling, so we never surface it in the UI.
  hints.push({
    type: "syllables",
    text: `${syllableCount} syllable${syllableCount !== 1 ? "s" : ""}`,
    spokenText: `${syllableCount} syllable${syllableCount !== 1 ? "s" : ""}`,
  });

  const availableHints = hints.filter((h) => !usedHints.includes(h.type));
  return availableHints.length > 0 ? availableHints[0] : null;
}

/**
 * Manage hints and hint type tracking for the current word.
 */
export function useHints(): UseHintsResult {
  const [hints, setHints] = useState<Hint[]>([]);
  const hintTypesRef = useRef<HintType[]>([]);

  const addHint = useCallback((wordData: WordData): Hint | null => {
    if (!wordData) return null;

    const hint = generateHint(wordData, hintTypesRef.current);

    if (hint) {
      setHints((prev) => [...prev, hint]);
      hintTypesRef.current = [...hintTypesRef.current, hint.type];
    }

    return hint;
  }, []);

  /**
   * Clear all hints and reset type tracking.
   *
   * Use this when starting a new word/round to completely reset hint state.
   */
  const clearHints = useCallback((): void => {
    setHints([]);
    hintTypesRef.current = [];
  }, []);

  /**
   * Reset hint type tracking without clearing the visible hint history.
   *
   * Use this when the word pool changes (difficulty/grade level) but you want
   * to keep previously displayed hints visible on screen.
   */
  const resetHintTracking = useCallback((): void => {
    hintTypesRef.current = [];
  }, []);

  return {
    hints,
    addHint,
    clearHints,
    resetHintTracking,
  };
}

// Re-export types for convenience
export type {
  HintType,
  Hint,
  WordData,
  UseHintsResult,
} from "./useHints.types";
