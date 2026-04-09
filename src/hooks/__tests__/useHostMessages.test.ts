import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHostMessages } from "../useHostMessages";

describe("useHostMessages", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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

  describe("toast notifications", () => {
    it("starts with no toast", () => {
      const { result } = renderHook(() => useHostMessages());
      expect(result.current.toast).toBeNull();
    });

    it("shows a toast notification", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.showToast("success", "Great job!");
      });

      expect(result.current.toast).not.toBeNull();
      expect(result.current.toast!.text).toBe("Great job!");
      expect(result.current.toast!.level).toBe("success");
    });

    it("dismisses the current toast", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.showToast("info", "Test toast");
      });

      expect(result.current.toast).not.toBeNull();

      act(() => {
        result.current.dismissToast();
      });

      expect(result.current.toast).toBeNull();
    });

    it("auto-dismisses toast after duration", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.showToast("success", "Auto dismiss", 1000);
      });

      expect(result.current.toast).not.toBeNull();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.toast).toBeNull();
    });
  });

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

      expect(result.current.messages.length).toBeGreaterThanOrEqual(1);
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

    it("triggers streak milestone toast at milestone streaks", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.onFeedback("correct", { streak: 5 });
      });

      // Should have at least 2 messages (feedback + milestone)
      expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
    });

    it("shows toast for feedback events", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.onFeedback("correct", { streak: 1 });
      });

      expect(result.current.toast).not.toBeNull();
      expect(result.current.toast!.level).toBe("success");
    });

    it("shows error toast for incorrect feedback", () => {
      const { result } = renderHook(() => useHostMessages());

      act(() => {
        result.current.onFeedback("incorrect", { targetWord: "test" });
      });

      expect(result.current.toast).not.toBeNull();
      expect(result.current.toast!.level).toBe("error");
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
