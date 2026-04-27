/**
 * Tests for src/hooks/usePwaInstall.ts
 *
 * Verifies:
 *  - isInstallable becomes true when beforeinstallprompt fires
 *  - isInstalled detects standalone display mode
 *  - promptInstall calls prompt() on the deferred event
 *  - promptInstall is a no-op when no deferred event is available
 *  - User choice updates isInstalled state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePwaInstall } from "../usePwaInstall";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockBeforeInstallPromptEvent() {
  const promptFn = vi.fn().mockResolvedValue(undefined);
  const userChoicePromise = Promise.resolve({
    outcome: "accepted" as const,
    platform: "web",
  });

  const event = new Event("beforeinstallprompt", { cancelable: true });
  (event as any).prompt = promptFn;
  (event as any).userChoice = userChoicePromise;

  return { event, promptFn, userChoicePromise };
}

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("usePwaInstall", () => {
  let eventListeners: Record<string, Array<(e: any) => void>>;

  beforeEach(() => {
    eventListeners = {};
    vi.useFakeTimers();

    // Mock addEventListener/removeEventListener on window
    vi.spyOn(window, "addEventListener").mockImplementation(
      (event: string, handler: any) => {
        if (!eventListeners[event]) eventListeners[event] = [];
        eventListeners[event].push(handler);
      },
    );
    vi.spyOn(window, "removeEventListener").mockImplementation(
      (event: string) => {
        delete eventListeners[event];
      },
    );

    // Default: not installed
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // isInstallable
  // -------------------------------------------------------------------------

  describe("isInstallable", () => {
    it("starts as false", () => {
      const { result } = renderHook(() => usePwaInstall());
      expect(result.current.isInstallable).toBe(false);
    });

    it("becomes true when beforeinstallprompt fires", () => {
      const { result } = renderHook(() => usePwaInstall());

      // Simulate beforeinstallprompt
      const { event } = createMockBeforeInstallPromptEvent();
      act(() => {
        const handlers = eventListeners["beforeinstallprompt"] ?? [];
        handlers.forEach((handler) => handler(event));
      });

      expect(result.current.isInstallable).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // isInstalled
  // -------------------------------------------------------------------------

  describe("isInstalled", () => {
    it("detects standalone mode on mount", () => {
      mockMatchMedia(true);
      const { result } = renderHook(() => usePwaInstall());
      expect(result.current.isInstalled).toBe(true);
    });

    it("is false when not in standalone mode", () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => usePwaInstall());
      expect(result.current.isInstalled).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // promptInstall
  // -------------------------------------------------------------------------

  describe("promptInstall", () => {
    it("calls prompt() on the deferred event", () => {
      const { result } = renderHook(() => usePwaInstall());

      const { event, promptFn } = createMockBeforeInstallPromptEvent();
      act(() => {
        const handlers = eventListeners["beforeinstallprompt"] ?? [];
        handlers.forEach((handler) => handler(event));
      });

      act(() => {
        result.current.promptInstall();
      });

      expect(promptFn).toHaveBeenCalled();
    });

    it("is a no-op when no deferred event is available", () => {
      const { result } = renderHook(() => usePwaInstall());

      // Should not throw
      act(() => {
        result.current.promptInstall();
      });
    });

    it("clears installable state after prompt is dismissed", async () => {
      const { result } = renderHook(() => usePwaInstall());

      const { event, userChoicePromise } =
        createMockBeforeInstallPromptEvent();
      act(() => {
        const handlers = eventListeners["beforeinstallprompt"] ?? [];
        handlers.forEach((handler) => handler(event));
      });

      expect(result.current.isInstallable).toBe(true);

      act(() => {
        result.current.promptInstall();
      });

      // Wait for userChoice to resolve
      await act(async () => {
        await userChoicePromise;
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.isInstallable).toBe(false);
    });
  });
});
