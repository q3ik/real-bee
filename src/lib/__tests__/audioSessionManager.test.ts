import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Override the global vi.mock set in src/test/setup.tsx so the real module
// is loaded for behavioural tests in this file. vi.unmock() is hoisted by
// Vitest's transform step and therefore runs before any import() calls.
vi.unmock("@/lib/audioSessionManager");

// ---------------------------------------------------------------------------
// AudioContext stub factory — creates a fresh stub per test so state does not
// leak between test cases.
// ---------------------------------------------------------------------------
type AudioContextState = "running" | "suspended" | "closed";

interface AudioContextStub {
  state: AudioContextState;
  resume: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  createBuffer: ReturnType<typeof vi.fn>;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  destination: Record<string, never>;
  currentTime: number;
  sampleRate: number;
}

type AudioContextStubConstructor = new (
  options?: AudioContextOptions,
) => AudioContextStub;

function makeAudioContextStub(
  initialState: AudioContextState = "running",
): AudioContextStubConstructor {
  return class implements AudioContextStub {
    state: AudioContextState = initialState;
    resume = vi.fn(async () => {
      this.state = "running";
    });
    close = vi.fn(async () => {
      this.state = "closed";
    });
    createBuffer = vi.fn();
    createOscillator = vi.fn();
    createGain = vi.fn();
    destination = {} as Record<string, never>;
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
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // Interface contract
  // -------------------------------------------------------------------------
  it("exports audioSessionManager with the expected interface", async () => {
    vi.stubGlobal("AudioContext", makeAudioContextStub());
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    const methods: Array<keyof typeof audioSessionManager> = [
      "initialize",
      "ensureActive",
      "cleanup",
      "getRoutingState",
      "getContext",
      "getInitialized",
    ];
    for (const method of methods) {
      expect(typeof audioSessionManager[method]).toBe("function");
    }
  });

  // -------------------------------------------------------------------------
  // Bug fix #1: sampleRate must NOT be locked to 44100
  // -------------------------------------------------------------------------
  it("does not force sampleRate: 44100 when creating the AudioContext", async () => {
    let capturedOptions: AudioContextOptions | undefined;
    vi.stubGlobal(
      "AudioContext",
      class {
        state = "running";
        resume = vi.fn();
        close = vi.fn();
        destination = {};
        currentTime = 0;
        sampleRate = 48000;
        constructor(options?: AudioContextOptions) {
          capturedOptions = options;
        }
      },
    );
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    await audioSessionManager.initialize();
    expect(capturedOptions).not.toHaveProperty("sampleRate");
  });

  // -------------------------------------------------------------------------
  // Bug fix #2: context must be nulled on initialize() failure
  // -------------------------------------------------------------------------
  it("nulls audioContext when initialize() fails so ensureActive() retries cleanly", async () => {
    vi.stubGlobal(
      "AudioContext",
      class {
        state = "suspended";
        resume = vi.fn().mockRejectedValue(new Error("resume rejected"));
        close = vi.fn();
        destination = {};
        currentTime = 0;
        sampleRate = 48000;
      },
    );
    const { audioSessionManager } = await import("@/lib/audioSessionManager");

    // First call — initialize fails due to resume rejection
    const first = await audioSessionManager.initialize();
    expect(first.success).toBe(false);
    expect(audioSessionManager.getContext()).toBeNull();
    expect(audioSessionManager.getInitialized()).toBe(false);

    // Second call — ensureActive() should re-enter initialize(), not hang.
    // Replace stub with a healthy one for the retry.
    vi.stubGlobal("AudioContext", makeAudioContextStub("running"));
    const second = await audioSessionManager.ensureActive();
    expect(second.success).toBe(true);
    expect(audioSessionManager.getInitialized()).toBe(true);
  });

  // -------------------------------------------------------------------------
  // initialize() — happy path
  // -------------------------------------------------------------------------
  it("initialize() sets initialized=true and returns success", async () => {
    vi.stubGlobal("AudioContext", makeAudioContextStub("running"));
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    const result = await audioSessionManager.initialize();
    expect(result.success).toBe(true);
    expect(audioSessionManager.getInitialized()).toBe(true);
    expect(audioSessionManager.getContext()).not.toBeNull();
  });

  it("initialize() is idempotent — second call skips re-creation", async () => {
    let constructCount = 0;
    vi.stubGlobal(
      "AudioContext",
      class {
        state = "running";
        resume = vi.fn();
        close = vi.fn();
        destination = {};
        currentTime = 0;
        sampleRate = 48000;
        constructor() {
          constructCount++;
        }
      },
    );
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    await audioSessionManager.initialize();
    await audioSessionManager.initialize();
    expect(constructCount).toBe(1);
  });

  it("initialize() resumes a suspended context", async () => {
    vi.stubGlobal("AudioContext", makeAudioContextStub("suspended"));
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    const result = await audioSessionManager.initialize();
    expect(result.success).toBe(true);
    expect(audioSessionManager.getContext()!.resume).toHaveBeenCalled();
  });

  it("initialize() returns an error when AudioContext is not supported", async () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    const result = await audioSessionManager.initialize();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not supported/i);
  });

  // -------------------------------------------------------------------------
  // ensureActive()
  // -------------------------------------------------------------------------
  it("ensureActive() initializes when no context exists", async () => {
    vi.stubGlobal("AudioContext", makeAudioContextStub("running"));
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    const result = await audioSessionManager.ensureActive();
    expect(result.success).toBe(true);
    expect(audioSessionManager.getInitialized()).toBe(true);
  });

  it("ensureActive() resumes a suspended context without re-initializing", async () => {
    vi.stubGlobal("AudioContext", makeAudioContextStub("running"));
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    await audioSessionManager.initialize();

    // Manually suspend the context after init.
    // AudioContext.state is readonly in the TS DOM lib; cast to the minimal
    // structural type needed rather than widening to any.
    (audioSessionManager.getContext() as { state: string }).state =
      "suspended";
    const result = await audioSessionManager.ensureActive();
    expect(result.success).toBe(true);
    expect(audioSessionManager.getContext()!.resume).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // cleanup()
  // -------------------------------------------------------------------------
  it("cleanup() closes the context and resets state", async () => {
    vi.stubGlobal("AudioContext", makeAudioContextStub("running"));
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
    vi.stubGlobal("AudioContext", makeAudioContextStub());
    const { audioSessionManager } = await import("@/lib/audioSessionManager");
    const result = await audioSessionManager.cleanup();
    expect(result.success).toBe(true);
  });

  // -------------------------------------------------------------------------
  // audioManager delegation smoke test
  // -------------------------------------------------------------------------
  it("audioManager imports without errors and exposes expected API", async () => {
    vi.stubGlobal("AudioContext", makeAudioContextStub());
    const mod = await import("@/lib/audioManager");
    expect(mod.audioManager).toBeDefined();
    expect(typeof mod.audioManager.speak).toBe("function");
    expect(typeof mod.audioManager.playEffect).toBe("function");
    expect(typeof mod.audioManager.setMuted).toBe("function");
  });
});
