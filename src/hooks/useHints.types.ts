/**
 * Hint type identifier
 *
 * Strict literal types based on hint generation logic
 * Prevents typos and enforces valid hint types at compile time.
 */
export type HintType =
  | "vowel"
  | "double"
  | "length"
  | "first"
  | "last"
  | "syllables";

/**
 * Generated hint object
 */
export interface Hint {
  type: HintType;
  text: string;
  spokenText?: string;
}

/**
 * Word data for hint generation.
 * Aligned with the centralized `Word` type from `src/types/`.
 */
export interface WordData {
  word: string;
  definition?: string;
  sentence?: string;
  syllables?: string;
}

/**
 * Return type for useHints hook
 */
export interface UseHintsResult {
  hints: Hint[];
  addHint: (wordData: WordData) => Hint | null;
  clearHints: () => void;
  resetHintTracking: () => void;
}
