import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

describe("AudioSessionManager integration", () => {
  beforeAll(() => {
    // Provide minimal AudioContext stub for jsdom environment
    if (typeof window !== "undefined" && !window.AudioContext) {
      (window as any).AudioContext = class {
        state = "running";
        resume = vi.fn().mockResolvedValue(undefined);
        close = vi.fn().mockResolvedValue(undefined);
        createBuffer = vi.fn();
        createOscillator = vi.fn();
        createGain = vi.fn();
        destination = {};
        currentTime = 0;
        sampleRate = 44100;
      };
    }
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("audioManager imports audioSessionManager without errors", async () => {
    const mod = await import("@/lib/audioManager");
    expect(mod.audioManager).toBeDefined();
    expect(typeof mod.audioManager.speak).toBe("function");
    expect(typeof mod.audioManager.playEffect).toBe("function");
    expect(typeof mod.audioManager.setMuted).toBe("function");
  });

  it("audioSessionManager has expected interface", async () => {
    const asm = await import("@/lib/audioSessionManager");
    expect(asm.audioSessionManager).toBeDefined();
    const methods = [
      "initialize",
      "ensureActive",
      "cleanup",
      "getRoutingState",
      "getContext",
    ];
    for (const method of methods) {
      expect(typeof (asm.audioSessionManager as any)[method]).toBe("function");
    }
  });

  it("cleanup returns success", async () => {
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    const result = await audioSessionManager.cleanup();
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
});
