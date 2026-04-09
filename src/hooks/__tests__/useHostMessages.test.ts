import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHostMessages } from "../useHostMessages";

// sonner is used for toasts — mock it so we can assert calls without a DOM
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("useHostMessages", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  describe("basic message management", () => {
    it("starts with empty messages", () => {
      const { result } = renderHook(() => useHostMessages());
      expect(result.current.messages).toEqual([]);
    });

    it("adds a message to the transcript", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.addMessage("word", "hello");
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].type).toBe("word");
      expect(result.current.messages[0].text).toBe("hello");
    });

    it("clears all messages", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.addMessage("word", "hello");
        result.current.addMessage("system", "test");
      });

      expect(result.current.messages).toHaveLength(2);

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  describe("triggerMessage — HostMessage contract", () => {
    it("starts with no currentMessage", () => {
      const { result } = renderHook(() => useHostMessages());
      expect(result.current.currentMessage).toBeNull();
    });

    it("triggerMessage('correct') sets currentMessage with encouraging tone", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.triggerMessage("correct");
      });

      expect(result.current.currentMessage).not.toBeNull();
      expect(result.current.currentMessage!.tone).toBe("encouraging");
      expect(result.current.currentMessage!.text).toContain("Correct");
      expect(result.current.currentMessage!.speakAloud).toBe(true);
    });

    it("triggerMessage('incorrect') sets currentMessage with consoling tone", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.triggerMessage("incorrect");
      });

      expect(result.current.currentMessage!.tone).toBe("consoling");
    });

    it("triggerMessage('streak-5') sets currentMessage with celebratory tone", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.triggerMessage("streak-5");
      });

      expect(result.current.currentMessage!.tone).toBe("celebratory");
      expect(result.current.currentMessage!.text).toContain("5");
    });

    it("triggerMessage('streak-3') sets currentMessage with celebratory tone", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.triggerMessage("streak-3");
      });

      expect(result.current.currentMessage!.tone).toBe("celebratory");
    });

    it("triggerMessage('streak-10') sets currentMessage with celebratory tone", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.triggerMessage("streak-10");
      });

      expect(result.current.currentMessage!.tone).toBe("celebratory");
    });

    it("clearMessage() resets currentMessage to null", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.triggerMessage("correct");
      });
      expect(result.current.currentMessage).not.toBeNull();

      act(() => {
        result.current.clearMessage();
      });
      expect(result.current.currentMessage).toBeNull();
    });

    it("speakAloud fires the speak callback after 300ms", () => {
      const { result } = renderHook(() => useHostMessages());
      const speak = vi.fn();

      act(() => {
        result.current.triggerMessage("correct", speak);
      });

      expect(speak).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(speak).toHaveBeenCalledOnce();
      expect(speak).toHaveBeenCalledWith(expect.stringContaining("Correct"));
    });

    it("speakAloud is false for hint-used — speak callback is NOT called", () => {
      const { result } = renderHook(() => useHostMessages());
      const speak = vi.fn();

      act(() => {
        result.current.triggerMessage("hint-used", speak);
        vi.advanceTimersByTime(500);
      });

      expect(speak).not.toHaveBeenCalled();
    });

    it("a second triggerMessage cancels the pending speak timer", () => {
      const { result } = renderHook(() => useHostMessages());
      const speak = vi.fn();

      act(() => {
        result.current.triggerMessage("correct", speak);
        // Supersede before the 300ms fires
        result.current.triggerMessage("incorrect", speak);
        vi.advanceTimersByTime(300);
      });

      // Only one call — from the second trigger's timer, not the first
      expect(speak).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  describe("feedback state machine", () => {
    it("processes correct feedback event", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.onFeedback("correct", { streak: 1 });
      });

      expect(result.current.messages.length).toBeGreaterThanOrEqual(1);
      const lastMsg =
        result.current.messages[result.current.messages.length - 1];
      expect(lastMsg.type).toBe("feedback");
      expect(lastMsg.text).toContain("Correct");
    });

    it("processes incorrect feedback event with target word", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.onFeedback("incorrect", { targetWord: "elephant" });
      });

      const lastMsg =
        result.current.messages[result.current.messages.length - 1];
      expect(lastMsg.text).toContain("correct spelling");
      expect(lastMsg.text).toContain("e, l, e, p, h, a, n, t");
    });

    it("processes timeout feedback event", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.onFeedback("timeout", { targetWord: "cat" });
      });

      const lastMsg =
        result.current.messages[result.current.messages.length - 1];
      expect(lastMsg.text).toContain("Time's up");
      expect(lastMsg.text).toContain("cat");
    });

    it("triggers streak milestone toast at streak 5", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.onFeedback("correct", { streak: 5 });
      });

      // Should have at least 2 messages (feedback + milestone)
      expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
    });

    it("processes hint_given feedback event", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.onFeedback("hint_given");
      });

      const lastMsg =
        result.current.messages[result.current.messages.length - 1];
      expect(lastMsg.text).toContain("hint");
    });

    it("processes word_presented feedback event", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.onFeedback("word_presented", { word: "elephant" });
      });

      const lastMsg =
        result.current.messages[result.current.messages.length - 1];
      expect(lastMsg.text).toContain("elephant");
    });
  });
});
