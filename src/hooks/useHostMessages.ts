import { useCallback, useRef, useState } from "react";
import { toast as sonnerToast } from "sonner";
import type {
  FeedbackContext,
  FeedbackEvent,
  HostMessage,
  HostMessageTrigger,
  HostMessageTone,
  Message,
  MessageType,
  ToastLevel,
  UseHostMessagesResult,
} from "./useHostMessages.types";
import { STREAK_MILESTONES } from "../constants/game";

// ---------------------------------------------------------------------------
// HostMessage content map
// ---------------------------------------------------------------------------

const HOST_MESSAGES: Record<HostMessageTrigger, Omit<HostMessage, "id">> = {
  correct: {
    text: "Correct! Well done!",
    tone: "encouraging",
    speakAloud: true,
  },
  incorrect: {
    text: "Not quite — let's try again.",
    tone: "consoling",
    speakAloud: true,
  },
  "streak-3": {
    text: "3 in a row! You're on fire! 🔥",
    tone: "celebratory",
    speakAloud: true,
  },
  "streak-5": {
    text: "5 in a row! Amazing streak! 🌟",
    tone: "celebratory",
    speakAloud: true,
  },
  "streak-10": {
    text: "10 in a row! You're unstoppable! 🏆",
    tone: "celebratory",
    speakAloud: true,
  },
  "hint-used": {
    text: "Here's a hint to help you out.",
    tone: "neutral",
    speakAloud: false,
  },
  "session-start": {
    text: "Let's begin a new session!",
    tone: "encouraging",
    speakAloud: true,
  },
  "session-complete": {
    text: "Session complete! Great work!",
    tone: "celebratory",
    speakAloud: true,
  },
  "first-attempt": {
    text: "Take your time — spell it letter by letter.",
    tone: "encouraging",
    speakAloud: true,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a feedback message for a given event. */
function feedbackMessage(
  event: FeedbackEvent,
  context?: FeedbackContext,
): string {
  switch (event) {
    case "correct":
      return "Correct! Well done!";
    case "incorrect": {
      const targetWord = context?.targetWord ?? "the word";
      return `Not quite. The correct spelling is: ${targetWord.split("").join(", ")}`;
    }
    case "timeout": {
      const targetWord = context?.targetWord ?? "the word";
      return `Time's up! The word was: ${targetWord}`;
    }
    case "streak_milestone": {
      const streak = context?.streak ?? 0;
      return `Amazing! ${streak} in a row!`;
    }
    case "hint_given":
      return "Here is a hint to help you out.";
    case "word_presented": {
      const word = context?.word ?? "";
      return `Your word is: ${word}`;
    }
    default:
      return "";
  }
}

/** Determine the toast level for a feedback event. */
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

let messageIdCounter = 0;

/**
 * Manage host transcript messages with:
 * 1. A legacy message queue (addMessage / clearMessages)
 * 2. A structured HostMessage API (triggerMessage / currentMessage / clearMessage)
 * 3. Toast notifications (showToast / dismissToast / auto-dismiss)
 * 4. A feedback state machine (onFeedback)
 */
export function useHostMessages(): UseHostMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<HostMessage | null>(
    null,
  );
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addMessage = useCallback((type: MessageType, text: string): void => {
    setMessages((prev) => [...prev, { type, text, timestamp: Date.now() }]);
  }, []);

  const clearMessages = useCallback((): void => {
    setMessages([]);
  }, []);

  const showToast = useCallback(
    (level: ToastLevel, text: string, _durationMs = 2000): void => {
      switch (level) {
        case "success":
          sonnerToast.success(text);
          break;
        case "error":
          sonnerToast.error(text);
          break;
        case "warning":
          sonnerToast.warning(text);
          break;
        case "info":
        default:
          sonnerToast.info(text);
          break;
      }
    },
    [],
  );

  const dismissToast = useCallback((): void => {
    sonnerToast.dismiss();
  }, []);

  const triggerMessage = useCallback(
    (trigger: HostMessageTrigger, speak?: (text: string) => void): void => {
      // Cancel any pending speak timer from a previous trigger
      if (speakTimerRef.current) {
        clearTimeout(speakTimerRef.current);
        speakTimerRef.current = null;
      }

      const template = HOST_MESSAGES[trigger];
      if (!template) return;

      const msg: HostMessage = {
        ...template,
        id: `msg-${++messageIdCounter}`,
      };
      setCurrentMessage(msg);

      if (msg.speakAloud && speak) {
        speakTimerRef.current = setTimeout(() => {
          speak(msg.text);
          speakTimerRef.current = null;
        }, 300);
      }
    },
    [],
  );

  const clearMessage = useCallback((): void => {
    if (speakTimerRef.current) {
      clearTimeout(speakTimerRef.current);
      speakTimerRef.current = null;
    }
    setCurrentMessage(null);
  }, []);

  const onFeedback = useCallback(
    (event: FeedbackEvent, context?: FeedbackContext): void => {
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
    currentMessage,
    triggerMessage,
    clearMessage,
    showToast,
    dismissToast,
    onFeedback,
  };
}

// Re-export types for convenience
export type {
  MessageType,
  FeedbackEvent,
  HostMessageTrigger,
  HostMessageTone,
  ToastLevel,
  HostMessage,
  Message,
  ToastNotification,
  FeedbackContext,
  UseHostMessagesResult,
} from "./useHostMessages.types";
