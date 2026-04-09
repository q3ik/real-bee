import { useCallback, useRef, useState } from "react";
import { toast as sonnerToast } from "sonner";
import type {
  FeedbackContext,
  FeedbackEvent,
  HostMessage,
  HostMessageTrigger,
  Message,
  MessageType,
  UseHostMessagesReturn,
} from "./useHostMessages.types";
import { STREAK_MILESTONES } from "../constants/game";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stable ID generator for host messages */
function makeId(): string {
  return `hm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Map a HostMessageTrigger to a HostMessage.
 * All messages are fully typed — no `as` casts.
 */
function buildHostMessage(trigger: HostMessageTrigger): HostMessage {
  switch (trigger) {
    case "correct":
      return {
        id: makeId(),
        text: "Correct! Well done!",
        tone: "encouraging",
        speakAloud: true,
      };
    case "incorrect":
      return {
        id: makeId(),
        text: "Not quite — keep trying!",
        tone: "consoling",
        speakAloud: true,
      };
    case "streak-3":
      return {
        id: makeId(),
        text: "3 in a row! Great work!",
        tone: "celebratory",
        speakAloud: true,
      };
    case "streak-5":
      return {
        id: makeId(),
        text: "🔥 5 in a row! Incredible!",
        tone: "celebratory",
        speakAloud: true,
      };
    case "streak-10":
      return {
        id: makeId(),
        text: "🏆 10 in a row! You're on fire!",
        tone: "celebratory",
        speakAloud: true,
      };
    case "hint-used":
      return {
        id: makeId(),
        text: "Here's a hint to help you out.",
        tone: "neutral",
        speakAloud: false,
      };
    case "session-start":
      return {
        id: makeId(),
        text: "Let's begin! Good luck!",
        tone: "encouraging",
        speakAloud: true,
      };
    case "session-complete":
      return {
        id: makeId(),
        text: "Session complete! Great effort!",
        tone: "celebratory",
        speakAloud: true,
      };
    case "first-attempt":
      return {
        id: makeId(),
        text: "Give it your best shot!",
        tone: "encouraging",
        speakAloud: false,
      };
  }
}

/**
 * Generate a transcript text for a FeedbackEvent.
 * Uses the typed FeedbackContext — no `as` casts.
 */
function feedbackText(event: FeedbackEvent, ctx?: FeedbackContext): string {
  switch (event) {
    case "correct":
      return "Correct! Well done!";
    case "incorrect": {
      const w = ctx?.targetWord ?? "the word";
      return `Not quite. The correct spelling is: ${w.split("").join(", ")}`;
    }
    case "timeout": {
      const w = ctx?.targetWord ?? "the word";
      return `Time's up! The word was: ${w}`;
    }
    case "streak_milestone": {
      const s = ctx?.streak ?? 0;
      return `Amazing! ${s} in a row!`;
    }
    case "hint_given":
      return "Here is a hint to help you out.";
    case "word_presented": {
      const w = ctx?.word ?? "";
      return `Your word is: ${w}`;
    }
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manage host transcript messages with a feedback state machine.
 *
 * - `triggerMessage(trigger)` sets `currentMessage` (a HostMessage with tone +
 *   speakAloud flag) and fires an optional TTS callback after 300ms.
 * - `onFeedback(event, ctx)` appends to the message transcript and shows a
 *   sonner toast for visual feedback.
 * - Streak milestones (streak-3/5/10) are detected automatically inside
 *   onFeedback when event === 'correct' and ctx.streak is a milestone value.
 */
export function useHostMessages(): UseHostMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<HostMessage | null>(
    null,
  );
  // Ref to hold the 300ms speakAloud delay timer so it can be cleared on
  // unmount or when a new message supersedes the previous one.
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addMessage = useCallback((type: MessageType, text: string): void => {
    setMessages((prev) => [...prev, { type, text, timestamp: Date.now() }]);
  }, []);

  const clearMessages = useCallback((): void => {
    setMessages([]);
  }, []);

  const clearMessage = useCallback((): void => {
    setCurrentMessage(null);
  }, []);

  const triggerMessage = useCallback(
    (
      trigger: HostMessageTrigger,
      speak?: (text: string) => void,
    ): void => {
      // Cancel any pending speakAloud from a previous trigger
      if (speakTimerRef.current) {
        clearTimeout(speakTimerRef.current);
        speakTimerRef.current = null;
      }

      const message = buildHostMessage(trigger);
      setCurrentMessage(message);

      // Fire TTS 300ms after the trigger so it plays after answer audio
      if (message.speakAloud && speak) {
        speakTimerRef.current = setTimeout(() => {
          speak(message.text);
          speakTimerRef.current = null;
        }, 300);
      }
    },
    [],
  );

  const onFeedback = useCallback(
    (event: FeedbackEvent, context?: FeedbackContext): void => {
      const text = feedbackText(event, context);
      if (!text) return;

      // Append to transcript
      addMessage("feedback", text);

      // Visual feedback via sonner (no custom timer needed — sonner owns lifecycle)
      if (event === "correct") {
        sonnerToast.success(text);
      } else if (event === "incorrect" || event === "timeout") {
        sonnerToast.error(text);
      } else {
        sonnerToast(text);
      }

      // Streak milestone detection — fires secondary toast + transcript entry
      if (event === "correct" && context?.streak !== undefined) {
        const streak = context.streak;
        if (STREAK_MILESTONES.includes(streak)) {
          const milestoneText = `🔥 ${streak} in a row! Incredible!`;
          addMessage("toast", milestoneText);
          sonnerToast.success(milestoneText, { duration: 3000 });
        }
      }
    },
    [addMessage],
  );

  return {
    messages,
    addMessage,
    clearMessages,
    currentMessage,
    triggerMessage,
    clearMessage,
    onFeedback,
  };
}

// Re-export types for convenience
export type {
  MessageType,
  FeedbackEvent,
  FeedbackContext,
  HostMessage,
  HostMessageTrigger,
  Message,
  UseHostMessagesReturn,
  UseHostMessagesResult,
} from "./useHostMessages.types";
