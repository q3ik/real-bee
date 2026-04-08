/**
 * Voice recognition constants.
 * Extracted from useVoiceRecognition.ts for centralized configuration.
 */

/**
 * Timeout in ms before silence is detected and listening stops.
 */
export const SILENCE_TIMEOUT_MS = 3000;

/**
 * Maximum listening duration in ms before auto-stop.
 */
export const MAX_LISTEN_MS = 15000;

/**
 * Grace period after onend to collect final transcript fragments.
 */
export const TRANSCRIPT_GRACE_PERIOD_MS = 200;

/**
 * Pattern for stripping completion cue words from transcript.
 * Used with .replace() to remove all occurrences (/g flag).
 */
export const COMPLETION_CUE_PATTERN = /\b(done|finished|that'?s it|that is it)\b/gi;

/**
 * Pattern for detecting completion cues in transcript.
 * Used with .test() for detection only (no /g flag to avoid stateful lastIndex).
 */
export const COMPLETION_CUE_DETECTION_PATTERN = /\b(done|finished|that'?s it|that is it)\b/i;

/**
 * SpeechRecognition language locale.
 */
export const SPEECH_RECOGNITION_LANG = 'en-US';

/**
 * NATO phonetic alphabet mapping (lowercase variant).
 * Maps spoken phonetic words to their corresponding letters.
 */
export const NATO_ALPHABET: Record<string, string> = {
  alpha: 'a', bravo: 'b', charlie: 'c', delta: 'd', echo: 'e',
  foxtrot: 'f', golf: 'g', hotel: 'h', india: 'i', juliet: 'j',
  kilo: 'k', lima: 'l', mike: 'm', november: 'n', oscar: 'o',
  papa: 'p', quebec: 'q', romeo: 'r', sierra: 's', tango: 't',
  uniform: 'u', victor: 'v', whiskey: 'w', xray: 'x', yankee: 'y', zulu: 'z',
};

/**
 * Words that signal the user has finished spelling.
 */
export const STOP_WORDS = ['stop'] as const;

/**
 * Threshold for considering a single spoken word as a whole-word attempt
 * (not letter-by-letter spelling).
 */
export const WHOLE_WORD_MIN_LENGTH = 4;

/**
 * Minimum fraction of target word length to accept a partial spelling match.
 */
export const PARTIAL_SPELL_THRESHOLD = 0.5;
