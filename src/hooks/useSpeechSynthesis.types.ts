/**
 * Message types for transcript display
 */
export type TranscriptMessageType = 'word' | 'sentence' | 'definition' | 'system' | string;

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
  /** Whether the Gemini TTS backend is available */
  ttsSupported: boolean;
}

/**
 * Speech synthesis action handlers
 */
export interface SpeechSynthesisActions {
  /** Speak text aloud (Gemini TTS → Web Speech fallback) */
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
