/**
 * Type of host message
 */
export type MessageType =
  | "word"
  | "sentence"
  | "definition"
  | "system"
  | "player"
  | "feedback"
  | "toast"
  | string;

/**
 * Feedback event type for the state machine
 */
export type FeedbackEvent =
  | "correct"
  | "incorrect"
  | "timeout"
  | "streak_milestone"
  | "hint_given"
  | "word_presented";

/**
 * Trigger names for the host message state machine.
 * Maps to the contract specified in the issue requirement (SUB-14).
 */
export type HostMessageTrigger =
  | "correct"
  | "incorrect"
  | "streak-3"
  | "streak-5"
  | "streak-10"
  | "hint-used"
  | "session-start"
  | "session-complete"
  | "first-attempt";

/**
 * Tone for a host message, driving TTS and visual style.
 */
export type HostMessageTone =
  | "encouraging"
  | "celebratory"
  | "neutral"
  | "consoling";

/**
 * A structured host message.
 */
export interface HostMessage {
  id: string;
  text: string;
  tone: HostMessageTone;
  /** When true, the caller should invoke useSpeechSynthesis.speak(text) after a 300ms delay */
  speakAloud: boolean;
}

/**
 * Toast notification level
 */
export type ToastLevel = "success" | "error" | "info" | "warning";

/**
 * Transcript message object
 */
export interface Message {
  type: MessageType;
  text: string;
  timestamp: number;
}

/**
 * Return type for useHostMessages hook.
 * Satisfies both the legacy UseHostMessagesResult contract and
 * the new HostMessage / triggerMessage requirement from SUB-14.
 */
export interface UseHostMessagesReturn {
  /** Message transcript */
  messages: Message[];
  /** Add a message to the transcript */
  addMessage: (type: MessageType, text: string) => void;
  /** Clear the entire transcript */
  clearMessages: () => void;

  /** Current structured host message (set by triggerMessage), or null */
  currentMessage: HostMessage | null;
  /**
   * Trigger a host message by name.
   * @param trigger  The event that occurred.
   * @param speak    Optional callback invoked after 300ms when message.speakAloud is true.
   *                 Pass `(text) => useSpeechSynthesis.speak(text)` at the call-site.
   */
  triggerMessage: (
    trigger: HostMessageTrigger,
    speak?: (text: string) => void,
  ) => void;
  /** Clear the current host message */
  clearMessage: () => void;

  /** Process a feedback event (state machine trigger) */
  onFeedback: (event: FeedbackEvent, context?: FeedbackContext) => void;
}

/** Alias kept for backward-compat with existing imports */
export type UseHostMessagesResult = UseHostMessagesReturn;

/**
 * Typed context object passed to onFeedback, replacing the
 * unsafe Record<string, unknown> pattern.
 */
export interface FeedbackContext {
  /** Current streak count (used for milestone detection) */
  streak?: number;
  /** The correct target word (shown on incorrect / timeout) */
  targetWord?: string;
  /** Word being presented (used by word_presented event) */
  word?: string;
}
