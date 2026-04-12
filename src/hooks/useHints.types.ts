/**
 * Hint type identifier — covers both schema-sourced semantic hints and
 * structure-derived hints.
 *
 * Semantic hints (read from Word fields):
 *   - "definition"       → word.definition
 *   - "use-in-sentence"  → word.usageExample ?? word.sentence (target blanked)
 *   - "part-of-speech"   → word.partOfSpeech
 *   - "first-letter"     → word.word[0]
 *
 * Structural hints (derived from word shape):
 *   - "vowel"     → starts with vowel or consonant
 *   - "double"    → contains a repeated letter
 *   - "length"    → number of letters
 *   - "last"      → last letter
 *   - "syllables" → syllable count from word.syllables
 */
export type HintType =
  | "definition"
  | "use-in-sentence"
  | "part-of-speech"
  | "first-letter"
  | "vowel"
  | "double"
  | "length"
  | "last"
  | "syllables";

/**
 * Generated hint object — returned by useHints.addHint() and stored in state.
 */
export interface Hint {
  type: HintType;
  /** Text to render in the UI. */
  text: string;
  /** Optional override for TTS; falls back to `text` when absent. */
  spokenText?: string;
  /** Score cost for this hint (from game-engine/hints.ts HINT_COSTS). */
  costInPoints?: number;
}

/**
 * Word data consumed by useHints.
 * Aligned with the centralized `Word` type from `src/types/`.
 */
export interface WordData {
  word: string;
  definition?: string;
  /** Usage example sentence (target word should be blanked by getHint). */
  usageExample?: string;
  /** Fallback sentence when usageExample is absent. */
  sentence?: string;
  partOfSpeech?: string;
  syllables?: string;
}

/**
 * Return type for the useHints hook.
 */
export interface UseHintsResult {
  hints: Hint[];
  addHint: (wordData: WordData) => Hint | null;
  clearHints: () => void;
  resetHintTracking: () => void;
}
