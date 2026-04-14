import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { onRequestPost } from "../stt.js";
import type { Env, PagesContext } from "../../types.js";

const mockEnv: Env = {
  DB: {} as unknown as D1Database,
  GEMINI_API_KEY: "test-key",
  ALLOWED_ORIGINS: "http://localhost:5173",
};

function makeContext(
  body: unknown,
  origin = "http://localhost:5173",
): PagesContext {
  return {
    request: new Request("http://localhost/api/stt", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify(body),
    }),
    env: mockEnv,
    next: vi.fn(),
    waitUntil: vi.fn(),
  } as unknown as PagesContext;
}

describe("POST /api/stt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 400 for missing audio field", async () => {
    const res = await onRequestPost(makeContext({ mimeType: "audio/webm" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/audio/i);
  });

  it("returns 400 for invalid mimeType", async () => {
    const res = await onRequestPost(
      makeContext({ audio: "AAAA", mimeType: "video/mp4" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/mimeType/i);
  });

  it("returns 400 for missing mimeType", async () => {
    const res = await onRequestPost(makeContext({ audio: "AAAA" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const context = {
      request: new Request("http://localhost/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "http://localhost:5173",
        },
        body: "not-json",
      }),
      env: mockEnv,
      next: vi.fn(),
      waitUntil: vi.fn(),
    } as unknown as PagesContext;
    const res = await onRequestPost(context);
    expect(res.status).toBe(400);
  });

  it("returns 403 for disallowed origin", async () => {
    const res = await onRequestPost(
      makeContext(
        { audio: "AAAA", mimeType: "audio/webm" },
        "https://evil.com",
      ),
    );
    expect(res.status).toBe(403);
  });

  it("returns 503 when GEMINI_API_KEY is missing and Gemini is selected", async () => {
    const context = makeContext({ audio: "AAAA", mimeType: "audio/webm" });
    (context as unknown as { env: Env }).env = {
      ...mockEnv,
      GEMINI_API_KEY: "",
    };
    const res = await onRequestPost(context);
    expect(res.status).toBe(503);
  });

  it("returns { transcript: string } for valid input (Gemini)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "apple" }] } }],
        }),
      }),
    );

    const res = await onRequestPost(
      makeContext({ audio: "AAAA", mimeType: "audio/webm" }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { transcript: string };
    expect(body.transcript).toBe("apple");

    vi.unstubAllGlobals();
  });

  it("returns 500 when Gemini API returns non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "Service unavailable",
      }),
    );

    const res = await onRequestPost(
      makeContext({ audio: "AAAA", mimeType: "audio/webm" }),
    );
    expect(res.status).toBe(500);

    vi.unstubAllGlobals();
  });

  it("returns 400 for audio containing only whitespace", async () => {
    const res = await onRequestPost(
      makeContext({ audio: "   ", mimeType: "audio/webm" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/audio/i);
  });

  it("returns 500 when Gemini response has no transcript", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{}] } }],
        }),
      }),
    );

    const res = await onRequestPost(
      makeContext({ audio: "AAAA", mimeType: "audio/webm" }),
    );
    expect(res.status).toBe(500);

    vi.unstubAllGlobals();
  });

  // ── Cloudflare Whisper provider tests ─────────────────────────────────────

  it("returns 503 when AI binding is missing for Cloudflare Whisper", async () => {
    const context = makeContext({ audio: "AAAA", mimeType: "audio/webm" });
    (context as unknown as { env: Env }).env = {
      ...mockEnv,
      STT_PROVIDER: "cloudflare-whisper",
      AI: undefined,
    };
    const res = await onRequestPost(context);
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/AI/i);
  });

  it("calls env.AI.run with correct Whisper model string", async () => {
    const mockRun = vi.fn().mockResolvedValue({ text: "hello" });
    const mockAI = { run: mockRun } as unknown as Ai;

    const context = makeContext({ audio: "AAAA", mimeType: "audio/webm" });
    (context as unknown as { env: Env }).env = {
      ...mockEnv,
      STT_PROVIDER: "cloudflare-whisper",
      AI: mockAI,
    };

    const res = await onRequestPost(context);
    expect(res.status).toBe(200);

    expect(mockRun).toHaveBeenCalledWith(
      "@cf/openai/whisper-large-v3-turbo",
      expect.any(Object),
    );

    const body = (await res.json()) as { transcript: string };
    expect(body.transcript).toBe("hello");
  });

  // ── Deepgram provider tests ──────────────────────────────────────────────

  it("returns 503 when DEEPGRAM_API_KEY is missing for Deepgram", async () => {
    const context = makeContext({ audio: "AAAA", mimeType: "audio/webm" });
    (context as unknown as { env: Env }).env = {
      ...mockEnv,
      STT_PROVIDER: "deepgram",
      DEEPGRAM_API_KEY: "",
    };
    const res = await onRequestPost(context);
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Deepgram/i);
  });

  it("calls Deepgram Nova-3 API with correct URL, Authorization header, and model param", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: { channels: [{ alternatives: [{ transcript: "world" }] }] },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const context = makeContext({ audio: "AAAA", mimeType: "audio/webm" });
    (context as unknown as { env: Env }).env = {
      ...mockEnv,
      STT_PROVIDER: "deepgram",
      DEEPGRAM_API_KEY: "test-deepgram-key",
    };

    const res = await onRequestPost(context);
    expect(res.status).toBe(200);

    // Assert correct Deepgram URL with model=nova-3 and language=en
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("api.deepgram.com/v1/listen"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Token test-deepgram-key",
        }),
      }),
    );

    // Assert the URL contains model=nova-3
    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain("model=nova-3");

    const body = (await res.json()) as { transcript: string };
    expect(body.transcript).toBe("world");

    vi.unstubAllGlobals();
  });

  it("returns 500 when Deepgram API returns non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "Service unavailable",
      }),
    );

    const context = makeContext({ audio: "AAAA", mimeType: "audio/webm" });
    (context as unknown as { env: Env }).env = {
      ...mockEnv,
      STT_PROVIDER: "deepgram",
      DEEPGRAM_API_KEY: "key",
    };

    const res = await onRequestPost(context);
    expect(res.status).toBe(500);

    vi.unstubAllGlobals();
  });

  it("returns 500 when Deepgram response has no transcript", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: { channels: [{ alternatives: [{}] }] },
        }),
      }),
    );

    const context = makeContext({ audio: "AAAA", mimeType: "audio/webm" });
    (context as unknown as { env: Env }).env = {
      ...mockEnv,
      STT_PROVIDER: "deepgram",
      DEEPGRAM_API_KEY: "key",
    };

    const res = await onRequestPost(context);
    expect(res.status).toBe(500);

    vi.unstubAllGlobals();
  });
});
