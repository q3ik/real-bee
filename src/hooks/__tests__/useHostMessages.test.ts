/**
 * Unit tests for useHostMessages (SUB-14 AC item 6)
 *
 * AC item 6: messages with speakAloud:true trigger speak callback
 *
 * Supplements the existing 19 tests by explicitly asserting the TTS
 * integration path through triggerMessage's speak parameter.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHostMessages } from "../useHostMessages";

// Mock sonner to prevent DOM-less toast errors in the test environment
vi.mock("sonner", () => ({
  toast: Object.assign(
    vi.fn(() => "mock-toast-id"),
    {
      success: vi.fn(() => "mock-toast-id"),
      error: vi.fn(() => "mock-toast-id"),
      info: vi.fn(() => "mock-toast-id"),
      warning: vi.fn(() => "mock-toast-id"),
      dismiss: vi.fn(),
    },
  ),
}));

describe("useHostMessages — TTS speak integration (AC item 6)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls speak callback when trigger has speakAloud:true", () => {
    const { result } = renderHook(() => useHostMessages());
    const speak = vi.fn();

    act(() => {
      result.current.triggerMessage("correct", speak);
    });

    // speak is deferred by 300ms
    expect(speak).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(expect.stringContaining("Correct"));
  });

  it("does not call speak when trigger has speakAloud:false", () => {
    const { result } = renderHook(() => useHostMessages());
    const speak = vi.fn();

    act(() => {
      // 'hint-used' has speakAloud: false
      result.current.triggerMessage("hint-used", speak);
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(speak).not.toHaveBeenCalled();
  });

  it("cancels a pending speak timer when a second trigger fires immediately", () => {
    const { result } = renderHook(() => useHostMessages());
    const speak = vi.fn();

    act(() => {
      result.current.triggerMessage("correct", speak);
    });

    // Fire second trigger before the 300ms elapses
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.triggerMessage("streak-3", speak);
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Only the second trigger's speak should have fired
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(expect.stringContaining("3 in a row"));
  });

  it("sets currentMessage with correct tone for 'correct' trigger", () => {
    const { result } = renderHook(() => useHostMessages());

    act(() => {
      result.current.triggerMessage("correct");
    });

    expect(result.current.currentMessage).not.toBeNull();
    expect(result.current.currentMessage?.tone).toMatch(
      /encouraging|celebratory/,
    );
  });

  it("sets currentMessage for streak-5 trigger", () => {
    const { result } = renderHook(() => useHostMessages());

    act(() => {
      result.current.triggerMessage("streak-5");
    });

    expect(result.current.currentMessage?.text).toContain("5 in a row");
  });

  it("clears pending speak on clearMessage", () => {
    const { result } = renderHook(() => useHostMessages());
    const speak = vi.fn();

    act(() => {
      result.current.triggerMessage("session-start", speak);
    });

    act(() => {
      result.current.clearMessage();
      vi.advanceTimersByTime(500);
    });

    // clearMessage cancels the timer, so speak should never fire
    expect(speak).not.toHaveBeenCalled();
    expect(result.current.currentMessage).toBeNull();
  });
});
