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
 * Toast notification payload
 */
export interface ToastNotification {
  level: ToastLevel;
  text: string;
  durationMs: number;
}

/**
 * Return type for useHostMessages hook
 */
export interface UseHostMessagesResult {
  /** Message transcript */
  messages: Message[];
  /** Add a message to the transcript */
  addMessage: (type: MessageType, text: string) => void;
  /** Clear the entire transcript */
  clearMessages: () => void;

  /** Current active toast notification, or null */
  toast: ToastNotification | null;
  /** Show a toast notification */
  showToast: (level: ToastLevel, text: string, durationMs?: number) => void;
  /** Dismiss the current toast */
  dismissToast: () => void;

  /** Process a feedback event (state machine trigger) */
  onFeedback: (event: FeedbackEvent, context?: Record<string, unknown>) => void;
}
