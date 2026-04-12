/**
 * Hint type identifier — covers both schema-sourced semantic hints and
 * structure-derived hints.
 *
 * Semantic hints (read from Word fields):
 *   - "definition"       → word.definition
 *   - "use-in-sentence"  → word.usageExample ?? word.sentence (raw, not blanked)
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
  /** Usage example sentence returned verbatim as hint content (AC item 1). */
  usageExample?: string;
  /** Fallback sentence when usageExample is absent. */
  sentence?: string;
  partOfSpeech?: string;
  syllables?: string;
}

/**
 * Return type for the useHints hook.
 *
 * Includes the full API required by issue #34:
 *  - `requestHint`    — reveal next hint; returns null when exhausted
 *  - `availableHints` — ordered hint types still usable for the current word
 *  - `usedHints`      — hint types already revealed this round
 *  - `hintsRemaining` — how many more hints can be requested
 *  - `lastHint`       — the most recently revealed hint (null if none)
 */
export interface UseHintsResult {
  hints: Hint[];
  /** @deprecated Use `requestHint` instead. Kept for backward compatibility. */
  addHint: (wordData: WordData) => Hint | null;
  /** Reveal the next available hint for `wordData`. Returns null when exhausted. */
  requestHint: (wordData: WordData) => Hint | null;
  /** Ordered hint types that have not yet been used and are supported by the word. */
  availableHints: HintType[];
  /** Hint types already revealed in this round. */
  usedHints: HintType[];
  /** Number of hints still requestable (0 when all available hints are used). */
  hintsRemaining: number;
  /** The most recently revealed hint, or null if none has been requested yet. */
  lastHint: Hint | null;
  clearHints: () => void;
  resetHintTracking: () => void;
}
