/**
 * Known message types for transcript display.
 * Extend this union rather than widening to `string`.
 */
export type TranscriptMessageType = 'word' | 'sentence' | 'definition' | 'system' | 'player';

/**
 * Callback for adding messages to transcript
 */
export type AddMessageCallback = (type: TranscriptMessageType, text: string) => void;

/**
 * Configuration for useSpeechSynthesis hook
 */
export interface SpeechSynthesisConfig {
  /** Callback to add transcript messages */
  addMessage: AddMessageCallback;
  /** Whether sound effects / TTS are enabled */
  soundEnabled?: boolean;
  /** Callback when an unrecoverable TTS error occurs */
  onError?: (error: string) => void;
}

/**
 * Browser speech compatibility information
 */
export interface BrowserSpeechCompatibility {
  /** Whether AudioContext (required by audioManager) is available in this browser */
  ttsSupported: boolean;
}

/**
 * Speech synthesis action handlers
 */
export interface SpeechSynthesisActions {
  /** Speak text aloud (Gemini TTS → Web Speech fallback via audioManager) */
  speak: (text: string, callback?: () => void) => Promise<void>;
  /** Repeat the target word aloud */
  repeatWord: (word: string) => Promise<void>;
  /** Speak a sentence aloud */
  giveSentence: (sentence: string) => Promise<void>;
  /** Speak a definition aloud */
  giveDefinition: (definition: string) => Promise<void>;
  /** Speak a hint aloud */
  giveHint: (hintText: string) => Promise<void>;
}

/**
 * Return type for useSpeechSynthesis hook
 */
export type SpeechSynthesisResult = BrowserSpeechCompatibility & SpeechSynthesisActions;
