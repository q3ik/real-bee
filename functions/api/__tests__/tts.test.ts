import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { onRequestPost } from "../tts.js";
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
    request: new Request("http://localhost/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify(body),
    }),
    env: mockEnv,
    next: vi.fn(),
    waitUntil: vi.fn(),
  } as unknown as PagesContext;
}

describe("POST /api/tts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 400 for missing word", async () => {
    const res = await onRequestPost(makeContext({}));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/word/i);
  });

  it("returns 400 for word exceeding 500 chars", async () => {
    const res = await onRequestPost(makeContext({ word: "a".repeat(501) }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/500/);
  });

  it("returns 400 for invalid voice (Gemini provider)", async () => {
    const res = await onRequestPost(
      makeContext({ word: "apple", voice: "unknown-voice" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/voice/i);
  });

  it("does not validate voice when ElevenLabs provider is selected", async () => {
    // ElevenLabs doesn't use Gemini voices — invalid voice should not cause 400
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(10),
      }),
    );

    const context = makeContext({ word: "apple", voice: "not-a-gemini-voice" });
    (context as unknown as { env: Env }).env = {
      ...mockEnv,
      TTS_PROVIDER: "elevenlabs",
      ELEVENLABS_API_KEY: "eleven-key",
    };

    const res = await onRequestPost(context);
    expect(res.status).toBe(200);
    vi.unstubAllGlobals();
  });

  it("returns 503 when GEMINI_API_KEY is missing and Gemini is selected", async () => {
    const context = makeContext({ word: "apple" });
    (context as unknown as { env: Env }).env = {
      ...mockEnv,
      GEMINI_API_KEY: "",
    };
    const res = await onRequestPost(context);
    expect(res.status).toBe(503);
  });

  it("returns 503 when ELEVENLABS_API_KEY is missing and ElevenLabs is selected", async () => {
    const context = makeContext({ word: "apple" });
    (context as unknown as { env: Env }).env = {
      ...mockEnv,
      TTS_PROVIDER: "elevenlabs",
      ELEVENLABS_API_KEY: "",
    };
    const res = await onRequestPost(context);
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/ElevenLabs/i);
  });

  it("returns 403 for disallowed origin", async () => {
    const res = await onRequestPost(
      makeContext({ word: "apple" }, "https://evil.com"),
    );
    expect(res.status).toBe(403);
  });

  it("returns { audio, mimeType, sampleRate } for valid audio/pcm response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { inlineData: { data: "AAAA", mimeType: "audio/pcm" } },
                ],
              },
            },
          ],
        }),
      }),
    );

    const res = await onRequestPost(makeContext({ word: "apple" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      audio: string;
      mimeType: string;
      sampleRate: number;
    };
    expect(body.audio).toBe("AAAA");
    expect(body.mimeType).toBe("audio/pcm");
    expect(body.sampleRate).toBe(24000);

    vi.unstubAllGlobals();
  });

  it("returns 500 when Gemini returns a non-pcm mimeType", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { inlineData: { data: "AAAA", mimeType: "audio/wav" } },
                ],
              },
            },
          ],
        }),
      }),
    );

    const res = await onRequestPost(makeContext({ word: "apple" }));
    expect(res.status).toBe(500);

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

    const res = await onRequestPost(makeContext({ word: "apple" }));
    expect(res.status).toBe(500);
  });

  it("returns 400 for word containing only whitespace", async () => {
    const res = await onRequestPost(makeContext({ word: "   " }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/word/i);
  });

  it("returns 500 when Gemini response has no audio data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{}] } }],
        }),
      }),
    );

    const res = await onRequestPost(makeContext({ word: "apple" }));
    expect(res.status).toBe(500);

    vi.unstubAllGlobals();
  });

  it("returns 400 for invalid JSON body", async () => {
    const context = {
      request: new Request("http://localhost/api/tts", {
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

  // ── ElevenLabs provider tests ─────────────────────────────────────────────

  it("calls ElevenLabs endpoint with correct URL and xi-api-key header", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => {
        const buf = new ArrayBuffer(10);
        new Uint8Array(buf).set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        return buf;
      },
    });
    vi.stubGlobal("fetch", mockFetch);

    const context = makeContext({ word: "hello" });
    (context as unknown as { env: Env }).env = {
      ...mockEnv,
      TTS_PROVIDER: "elevenlabs",
      ELEVENLABS_API_KEY: "test-elevenlabs-key",
    };

    const res = await onRequestPost(context);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      audio: string;
      mimeType: string;
      sampleRate: number;
    };
    expect(body.mimeType).toBe("audio/mpeg");
    expect(body.sampleRate).toBe(44100);

    // Assert correct ElevenLabs URL and header
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/text-to-speech/"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "xi-api-key": "test-elevenlabs-key",
        }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it("uses eleven_flash_v2_5 model for ElevenLabs", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(10),
    });
    vi.stubGlobal("fetch", mockFetch);

    const context = makeContext({ word: "test" });
    (context as unknown as { env: Env }).env = {
      ...mockEnv,
      TTS_PROVIDER: "elevenlabs",
      ELEVENLABS_API_KEY: "key",
    };

    await onRequestPost(context);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          text: "test",
          model_id: "eleven_flash_v2_5",
          output_format: "mp3_44100_128",
        }),
      }),
    );

    vi.unstubAllGlobals();
  });
});
