/**
 * Unit tests for the Sentry integration layer.
 *
 * Strategy:
 *  - Mock @sentry/react so no real HTTP calls are made.
 *  - Verify that each call site passes the correct arguments to the
 *    relevant Sentry API (captureException, captureMessage, setUser, init).
 *  - Tests are deliberately narrow: they assert *what* is reported, not
 *    the exact shape of internal Sentry payloads.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Shared Sentry mock — hoisted so it is available before any imports.
// ---------------------------------------------------------------------------
vi.mock("@sentry/react", () => ({
  init: vi.fn(),
  setUser: vi.fn(),
  captureException: vi.fn(() => "mock-event-id"),
  captureMessage: vi.fn(() => "mock-event-id"),
  browserTracingIntegration: vi.fn(() => ({ name: "BrowserTracing" })),
  replayIntegration: vi.fn(() => ({ name: "Replay" })),
  flush: vi.fn(() => Promise.resolve(true)),
}));

// ---------------------------------------------------------------------------
// sentry.ts — initSentry wires up BrowserTracing + Replay
// ---------------------------------------------------------------------------
describe("initSentry", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("calls Sentry.init with browserTracingIntegration and replayIntegration when DSN is set", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://test@sentry.io/1");
    const SentryMod = await import("@sentry/react");
    const { initSentry } = await import("@/lib/sentry");
    initSentry();
    // Sentry.init is called with options that include an integrations function.
    // Verify the init call includes the expected configuration.
    expect(SentryMod.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://test@sentry.io/1",
        integrations: expect.any(Function),
      }),
    );
    // Verify the integrations function returns an array containing
    // BrowserTracing and Replay (the mock return values).
    const initCall = (SentryMod.init as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    const defaults: unknown[] = [];
    const integrations = initCall.integrations(defaults);
    expect(integrations).toContainEqual({ name: "BrowserTracing" });
    expect(integrations).toContainEqual({ name: "Replay" });
    // Verify replay config has maskAllText: false and blockAllMedia: false
    const replayCall = (
      SentryMod.replayIntegration as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      (c) => c[0] && c[0].maskAllText === false && c[0].blockAllMedia === false,
    );
    expect(replayCall).toBeDefined();
  });

  it("does not call Sentry.init when DSN is missing", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "");
    const SentryMod = await import("@sentry/react");
    const { initSentry } = await import("@/lib/sentry");
    initSentry();
    expect(SentryMod.init).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// api/client.ts — apiRequest reports final errors to Sentry
// ---------------------------------------------------------------------------
describe("apiRequest Sentry reporting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("calls Sentry.captureException after all retries are exhausted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network failure")),
    );
    const SentryMod = await import("@sentry/react");
    const { apiRequest } = await import("@/api/client");
    await expect(apiRequest("/api/test", {}, { retries: 1 })).rejects.toThrow();
    expect(SentryMod.captureException).toHaveBeenCalledTimes(1);
    expect(SentryMod.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ "api.endpoint": "/api/test" }),
      }),
    );
  });

  it("includes attempt count in extra payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network failure")),
    );
    const SentryMod = await import("@sentry/react");
    const { apiRequest } = await import("@/api/client");
    // retries: 2 means 3 total attempts (0, 1, 2)
    await expect(
      apiRequest("/api/test", {}, { retries: 2, retryDelayMs: 0 }),
    ).rejects.toThrow();
    expect(SentryMod.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        extra: expect.objectContaining({ attempt: 3, retries: 2 }),
      }),
    );
  });

  it("uses warning level for network errors (status 0)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("fetch failed")),
    );
    const SentryMod = await import("@sentry/react");
    const { apiRequest } = await import("@/api/client");
    await expect(apiRequest("/api/test", {})).rejects.toThrow();
    expect(SentryMod.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ level: "warning" }),
    );
  });

  it("uses error level for server-side errors (4xx/5xx)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ error: "Internal Server Error" }),
      }),
    );
    const SentryMod = await import("@sentry/react");
    const { apiRequest } = await import("@/api/client");
    await expect(apiRequest("/api/test", {})).rejects.toThrow();
    expect(SentryMod.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ level: "error" }),
    );
  });
});

// ---------------------------------------------------------------------------
// geminiClient.ts — post() captures both network rejections and HTTP errors
// ---------------------------------------------------------------------------
describe("geminiClient Sentry reporting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("calls Sentry.captureException when the proxy returns a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: vi.fn().mockResolvedValue({ error: "Service Unavailable" }),
      }),
    );
    const SentryMod = await import("@sentry/react");
    const { gemini } = await import("@/lib/geminiClient");
    await expect(gemini.tts({ word: "test" })).rejects.toThrow();
    expect(SentryMod.captureException).toHaveBeenCalledTimes(1);
    expect(SentryMod.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ "gemini.action": "tts" }),
      }),
    );
  });

  it("calls Sentry.captureException with warning level when fetch() rejects (network error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Failed to fetch")),
    );
    const SentryMod = await import("@sentry/react");
    const { gemini } = await import("@/lib/geminiClient");
    await expect(
      gemini.stt({ audio: "data", mimeType: "audio/webm" }),
    ).rejects.toThrow();
    expect(SentryMod.captureException).toHaveBeenCalledTimes(1);
    expect(SentryMod.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        level: "warning",
        tags: expect.objectContaining({
          "gemini.action": "stt",
          "gemini.status": "0",
        }),
      }),
    );
  });

  it("tags the correct action for stt calls (HTTP error path)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({}),
      }),
    );
    const SentryMod = await import("@sentry/react");
    const { gemini } = await import("@/lib/geminiClient");
    await expect(
      gemini.stt({ audio: "data", mimeType: "audio/webm" }),
    ).rejects.toThrow();
    expect(SentryMod.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ "gemini.action": "stt" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// sync.ts — upload failures and max-retries reported (once)
// ---------------------------------------------------------------------------
describe("sync.ts Sentry reporting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/lib/supabase");
    vi.doUnmock("@/game-engine/storage");
  });

  it("calls Sentry.captureMessage at warning level when Supabase upload fails", async () => {
    vi.doMock("@/lib/supabase", () => ({
      supabase: {
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: "uid-1" } } }),
        },
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockResolvedValue({ error: { message: "DB error" } }),
        }),
      },
    }));
    vi.doMock("@/game-engine/storage", () => ({
      getUnsyncedProgress: vi.fn().mockResolvedValue([
        {
          uid: "uid-1",
          score: 10,
          streak: 2,
          bestStreak: 5,
          masteredCount: 3,
          gradeLevel: "all",
          difficulty: "all",
          lastPlayed: new Date().toISOString(),
          synced: false,
        },
      ]),
      markProgressSynced: vi.fn(),
      getUnsyncedSessions: vi.fn().mockResolvedValue([]),
      saveGameProgress: vi.fn(),
      loadGameProgress: vi.fn().mockResolvedValue(null),
      saveSession: vi.fn(),
      markSessionsSynced: vi.fn(),
    }));
    const SentryMod = await import("@sentry/react");
    const { syncPending } = await import("@/lib/sync");
    await syncPending();
    expect(SentryMod.captureMessage).toHaveBeenCalledWith(
      "Sync upload failed",
      expect.objectContaining({
        level: "warning",
        tags: expect.objectContaining({ "sync.type": "progress" }),
      }),
    );
  });

  it("emits Sync max retries exceeded exactly once per stuck record", async () => {
    // localStorage stub
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    });
    // Pre-seed a retry entry already at MAX_SYNC_RETRIES
    store["real-bee-sync-retries"] = JSON.stringify([
      {
        uid: "uid-stuck",
        retryCount: 5,
        lastAttempt: Date.now(),
        reportedMaxRetries: false,
      },
    ]);

    vi.doMock("@/lib/supabase", () => ({
      supabase: {
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: "uid-stuck" } } }),
        },
        from: vi.fn(),
      },
    }));
    vi.doMock("@/game-engine/storage", () => ({
      getUnsyncedProgress: vi.fn().mockResolvedValue([
        {
          uid: "uid-stuck",
          score: 0,
          streak: 0,
          bestStreak: 0,
          masteredCount: 0,
          gradeLevel: "all",
          difficulty: "all",
          lastPlayed: new Date().toISOString(),
          synced: false,
        },
      ]),
      markProgressSynced: vi.fn(),
      getUnsyncedSessions: vi.fn().mockResolvedValue([]),
      saveGameProgress: vi.fn(),
      loadGameProgress: vi.fn().mockResolvedValue(null),
      saveSession: vi.fn(),
      markSessionsSynced: vi.fn(),
    }));

    const SentryMod = await import("@sentry/react");
    const { syncPending } = await import("@/lib/sync");

    // First call — should fire the event
    await syncPending();
    expect(SentryMod.captureMessage).toHaveBeenCalledWith(
      "Sync max retries exceeded",
      expect.objectContaining({ level: "error" }),
    );
    expect(SentryMod.captureMessage).toHaveBeenCalledTimes(1);

    // Reset mock call count
    vi.mocked(SentryMod.captureMessage).mockClear();

    // Second call — reportedMaxRetries is now true, should NOT re-fire
    await syncPending();
    expect(SentryMod.captureMessage).not.toHaveBeenCalled();
  });
});
