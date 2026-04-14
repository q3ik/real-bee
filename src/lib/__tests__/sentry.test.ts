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

    // Make the mocked init actually call the integrations callback so that
    // browserTracingIntegration / replayIntegration are invoked.
    (SentryMod.init as ReturnType<typeof vi.fn>).mockImplementation(
      (options: any) => {
        if (typeof options.integrations === "function") {
          options.integrations([]);
        }
      },
    );

    const { initSentry } = await import("@/lib/sentry");
    initSentry();

    expect(SentryMod.browserTracingIntegration).toHaveBeenCalled();
    expect(SentryMod.replayIntegration).toHaveBeenCalledWith(
      expect.objectContaining({ maskAllText: false, blockAllMedia: false }),
    );
    expect(SentryMod.init).toHaveBeenCalled();
  });

  it("does not call Sentry.init when DSN is missing", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", undefined);
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
// geminiClient.ts — post() captures proxy errors
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

  it("tags the correct action for stt calls", async () => {
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
// sync.ts — upload failures and max-retries reported
// ---------------------------------------------------------------------------
describe("sync.ts Sentry reporting", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("calls Sentry.captureMessage at warning level when Supabase upload fails", async () => {
    // Stub supabase to return an upload error
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
    // Stub storage to return one unsynced record
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
});
