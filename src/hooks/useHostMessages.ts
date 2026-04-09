import { useCallback, useRef, useState } from "react";
import type {
  FeedbackEvent,
  Message,
  MessageType,
  ToastLevel,
  ToastNotification,
  UseHostMessagesResult,
} from "./useHostMessages.types";
import { STREAK_MILESTONES } from "../constants/game";

/**
 * Generate a feedback message for a given event.
 */
function feedbackMessage(
  event: FeedbackEvent,
  context?: Record<string, unknown>,
): string {
  switch (event) {
    case "correct":
      return "Correct! Well done!";
    case "incorrect": {
      const targetWord = (context?.targetWord as string) ?? "the word";
      return `Not quite. The correct spelling is: ${targetWord.split("").join(", ")}`;
    }
    case "timeout": {
      const targetWord = (context?.targetWord as string) ?? "the word";
      return `Time's up! The word was: ${targetWord}`;
    }
    case "streak_milestone": {
      const streak = (context?.streak as number) ?? 0;
      return `Amazing! ${streak} in a row!`;
    }
    case "hint_given":
      return "Here is a hint to help you out.";
    case "word_presented": {
      const word = (context?.word as string) ?? "";
      return `Your word is: ${word}`;
    }
    default:
      return "";
  }
}

/**
 * Determine the toast level for a feedback event.
 */
function toastLevelForEvent(event: FeedbackEvent): ToastLevel {
  switch (event) {
    case "correct":
    case "streak_milestone":
      return "success";
    case "incorrect":
    case "timeout":
      return "error";
    case "hint_given":
    case "word_presented":
      return "info";
    default:
      return "info";
  }
}

/**
 * Manage host transcript messages with a feedback state machine
 * and toast notification system.
 *
 * - Messages are appended to a transcript for display.
 * - Toasts are shown briefly for key game events (correct, incorrect, streak).
 * - `onFeedback()` processes feedback events and triggers messages + toasts.
 */
export function useHostMessages(): UseHostMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addMessage = useCallback((type: MessageType, text: string): void => {
    setMessages((prev) => [...prev, { type, text, timestamp: Date.now() }]);
  }, []);

  const clearMessages = useCallback((): void => {
    setMessages([]);
  }, []);

  const showToast = useCallback(
    (level: ToastLevel, text: string, durationMs = 2000): void => {
      // Clear any existing toast timer
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      setToast({ level, text, durationMs });

      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, durationMs);
    },
    [],
  );

  const dismissToast = useCallback((): void => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const onFeedback = useCallback(
    (event: FeedbackEvent, context?: Record<string, unknown>): void => {
      const text = feedbackMessage(event, context);
      if (!text) return;

      // Add to transcript
      addMessage("feedback", text);

      // Show toast for key events
      const level = toastLevelForEvent(event);
      const duration = event === "streak_milestone" ? 3000 : 2000;
      showToast(level, text, duration);

      // Check for streak milestones on correct answers
      if (event === "correct" && context?.streak) {
        const streak = context.streak as number;
        if (STREAK_MILESTONES.includes(streak)) {
          const milestoneText = `🔥 ${streak} in a row! Incredible!`;
          addMessage("toast", milestoneText);
          showToast("success", milestoneText, 3000);
        }
      }
    },
    [addMessage, showToast],
  );

  return {
    messages,
    addMessage,
    clearMessages,
    toast,
    showToast,
    dismissToast,
    onFeedback,
  };
}

// Re-export types for convenience
export type {
  MessageType,
  FeedbackEvent,
  ToastLevel,
  ToastNotification,
  Message,
  UseHostMessagesResult,
} from "./useHostMessages.types";
