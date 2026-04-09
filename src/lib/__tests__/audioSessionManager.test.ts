import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// AudioContext stub factory — creates a fresh stub per test so state does not
// leak between test cases.
// ---------------------------------------------------------------------------
function makeAudioContextStub(initialState: "running" | "suspended" = "running") {
  return class {
    state: string = initialState;
    resume = vi.fn(async () => {
      this.state = "running";
    });
    close = vi.fn(async () => {
      this.state = "closed";
    });
    createBuffer = vi.fn();
    createOscillator = vi.fn();
    createGain = vi.fn();
    destination = {};
    currentTime = 0;
    sampleRate = 48000; // browser default — NOT 44100
  };
}

describe("AudioSessionManager", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Interface contract
  // -------------------------------------------------------------------------
  it("exports audioSessionManager with the expected interface", async () => {
    (window as any).AudioContext = makeAudioContextStub();
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    const methods = [
      "initialize",
      "ensureActive",
      "cleanup",
      "getRoutingState",
      "getContext",
      "getInitialized",
    ];
    for (const method of methods) {
      expect(typeof (audioSessionManager as any)[method]).toBe("function");
    }
  });

  // -------------------------------------------------------------------------
  // Bug fix #1: sampleRate must NOT be locked to 44100
  // -------------------------------------------------------------------------
  it("does not force sampleRate: 44100 when creating the AudioContext", async () => {
    let capturedOptions: AudioContextOptions | undefined;
    (window as any).AudioContext = class {
      state = "running";
      resume = vi.fn();
      close = vi.fn();
      destination = {};
      currentTime = 0;
      sampleRate = 48000;
      constructor(options?: AudioContextOptions) {
        capturedOptions = options;
      }
    };
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    await audioSessionManager.initialize();
    expect(capturedOptions).not.toHaveProperty("sampleRate");
  });

  // -------------------------------------------------------------------------
  // Bug fix #2: context must be nulled on initialize() failure
  // -------------------------------------------------------------------------
  it("nulls audioContext when initialize() fails so ensureActive() retries cleanly", async () => {
    (window as any).AudioContext = class {
      state = "suspended";
      resume = vi.fn().mockRejectedValue(new Error("resume rejected"));
      close = vi.fn();
      destination = {};
      currentTime = 0;
      sampleRate = 48000;
    };
    const { audioSessionManager } = await import("@/lib/audioSessionManager");

    // First call — initialize fails due to resume rejection
    const first = await audioSessionManager.initialize();
    expect(first.success).toBe(false);
    expect(audioSessionManager.getContext()).toBeNull();
    expect(audioSessionManager.getInitialized()).toBe(false);

    // Second call — ensureActive() should re-enter initialize(), not hang
    // Replace stub with a healthy one for the retry
    (window as any).AudioContext = makeAudioContextStub("running");
    const second = await audioSessionManager.ensureActive();
    expect(second.success).toBe(true);
    expect(audioSessionManager.getInitialized()).toBe(true);
  });

  // -------------------------------------------------------------------------
  // initialize() — happy path
  // -------------------------------------------------------------------------
  it("initialize() sets initialized=true and returns success", async () => {
    (window as any).AudioContext = makeAudioContextStub("running");
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    const result = await audioSessionManager.initialize();
    expect(result.success).toBe(true);
    expect(audioSessionManager.getInitialized()).toBe(true);
    expect(audioSessionManager.getContext()).not.toBeNull();
  });

  it("initialize() is idempotent — second call skips re-creation", async () => {
    let constructCount = 0;
    (window as any).AudioContext = class {
      state = "running";
      resume = vi.fn();
      close = vi.fn();
      destination = {};
      currentTime = 0;
      sampleRate = 48000;
      constructor() { constructCount++; }
    };
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    await audioSessionManager.initialize();
    await audioSessionManager.initialize();
    expect(constructCount).toBe(1);
  });

  it("initialize() resumes a suspended context", async () => {
    (window as any).AudioContext = makeAudioContextStub("suspended");
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    const result = await audioSessionManager.initialize();
    expect(result.success).toBe(true);
    expect(audioSessionManager.getContext()!.resume).toHaveBeenCalled();
  });

  it("initialize() returns an error when AudioContext is not supported", async () => {
    (window as any).AudioContext = undefined;
    (window as any).webkitAudioContext = undefined;
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    const result = await audioSessionManager.initialize();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not supported/i);
  });

  // -------------------------------------------------------------------------
  // ensureActive()
  // -------------------------------------------------------------------------
  it("ensureActive() initializes when no context exists", async () => {
    (window as any).AudioContext = makeAudioContextStub("running");
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    const result = await audioSessionManager.ensureActive();
    expect(result.success).toBe(true);
    expect(audioSessionManager.getInitialized()).toBe(true);
  });

  it("ensureActive() resumes a suspended context without re-initializing", async () => {
    const Stub = makeAudioContextStub("running");
    (window as any).AudioContext = Stub;
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    await audioSessionManager.initialize();

    // Manually suspend the context after init
    (audioSessionManager.getContext() as any).state = "suspended";
    const result = await audioSessionManager.ensureActive();
    expect(result.success).toBe(true);
    expect(audioSessionManager.getContext()!.resume).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // cleanup()
  // -------------------------------------------------------------------------
  it("cleanup() closes the context and resets state", async () => {
    (window as any).AudioContext = makeAudioContextStub("running");
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    await audioSessionManager.initialize();
    const ctx = audioSessionManager.getContext()!;
    const result = await audioSessionManager.cleanup();
    expect(result.success).toBe(true);
    expect(ctx.close).toHaveBeenCalled();
    expect(audioSessionManager.getContext()).toBeNull();
    expect(audioSessionManager.getInitialized()).toBe(false);
    expect(audioSessionManager.getRoutingState()).toBe("unknown");
  });

  it("cleanup() is a no-op when never initialized", async () => {
    (window as any).AudioContext = makeAudioContextStub();
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    const result = await audioSessionManager.cleanup();
    expect(result.success).toBe(true);
  });

  // -------------------------------------------------------------------------
  // audioManager delegation smoke test
  // -------------------------------------------------------------------------
  it("audioManager imports without errors and exposes expected API", async () => {
    (window as any).AudioContext = makeAudioContextStub();
    const mod = await import("@/lib/audioManager");
    expect(mod.audioManager).toBeDefined();
    expect(typeof mod.audioManager.speak).toBe("function");
    expect(typeof mod.audioManager.playEffect).toBe("function");
    expect(typeof mod.audioManager.setMuted).toBe("function");
  });
});
