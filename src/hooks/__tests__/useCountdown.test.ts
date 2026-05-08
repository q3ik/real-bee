import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCountdown } from "../useCountdown";

describe("useCountdown", () => {
  // Ensure real timers are restored after each test to prevent leakage
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initialization", () => {
    it("initializes with maxDuration", () => {
      const { result } = renderHook(() => useCountdown(5000));
      expect(result.current.remaining).toBe(5000);
      expect(result.current.percent).toBe(100);
    });

    it("accepts custom maxDuration", () => {
      const { result } = renderHook(() => useCountdown(30000));
      expect(result.current.remaining).toBe(30000);
      expect(result.current.percent).toBe(100);
    });
  });

  describe("start", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("starts the countdown", async () => {
      const { result } = renderHook(() => useCountdown(5000));

      act(() => {
        result.current.start();
      });

      // Advance timer by 1 interval (100ms)
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.remaining).toBeLessThan(5000);
      expect(result.current.percent).toBeLessThan(100);
    });
  });

  describe("stop", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("stops the countdown", async () => {
      const { result } = renderHook(() => useCountdown(5000));

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      const remainingAfter500ms = result.current.remaining;

      act(() => {
        result.current.stop();
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.remaining).toBe(remainingAfter500ms);
    });
  });

  describe("reset", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("resets countdown to initial maxDuration", async () => {
      const { result } = renderHook(() => useCountdown(5000));

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.remaining).toBe(5000);
      expect(result.current.percent).toBe(100);
    });

    it("stops the countdown when resetting", async () => {
      const onComplete = vi.fn();
      const { result } = renderHook(() => useCountdown(5000, { onComplete }));

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Reset stops and resets the timer to full duration
      act(() => {
        result.current.reset();
      });

      // After reset, advance timers - remaining should stay at 5000 (full reset)
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // The timer was stopped, so remaining should stay at maxDuration
      expect(result.current.remaining).toBe(5000);
      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  describe("onComplete callback", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("calls onComplete when countdown reaches zero", async () => {
      const onComplete = vi.fn();
      const { result } = renderHook(() => useCountdown(1000, { onComplete }));

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it("does not call onComplete when stopped manually", async () => {
      const onComplete = vi.fn();
      const { result } = renderHook(() => useCountdown(1000, { onComplete }));

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      act(() => {
        result.current.stop();
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  describe("percent calculation", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("calculates correct percent when half time is remaining", async () => {
      const { result } = renderHook(() => useCountdown(10000));

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Allow for slight timing variance
      expect(result.current.percent).toBeLessThanOrEqual(50);
      expect(result.current.percent).toBeGreaterThan(48);
    });

    it("never returns negative percent", async () => {
      const { result } = renderHook(() => useCountdown(1000));

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(result.current.percent).toBeGreaterThanOrEqual(0);
    });
  });

  describe("cleanup on unmount", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("stops timer on unmount", () => {
      const onComplete = vi.fn();
      const { result, unmount } = renderHook(() => useCountdown(1000, { onComplete }));

      act(() => {
        result.current.start();
      });

      unmount();

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(onComplete).not.toHaveBeenCalled();
    });
  });
});