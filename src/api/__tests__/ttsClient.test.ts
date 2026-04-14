/**
 * Tests for src/api/ttsClient.ts — TTS provider strategy and fallback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { requestTTS, getTtsProvider } from "../ttsClient";

function mockTtsResponse(
  audio = "AAAA",
  mimeType = "audio/pcm",
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ audio, mimeType, sampleRate: 24000 }),
  } as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockTtsError(status: number): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error: "TTS failed" }),
  } as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ttsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("getTtsProvider", () => {
    it("defaults to 'gemini' when VITE_TTS_PROVIDER is not set", () => {
      expect(getTtsProvider()).toBe("gemini");
    });
  });

  describe("requestTTS", () => {
    it("returns { audioBuffer, mimeType } on successful TTS response", async () => {
      mockTtsResponse();
      const result = await requestTTS({ word: "apple" });
      expect(result).toHaveProperty("audioBuffer");
      expect(result).toHaveProperty("mimeType");
      expect(result.audioBuffer).toBeInstanceOf(ArrayBuffer);
      expect(result.mimeType).toBe("audio/pcm");
    });

    it("returns audio/mpeg mimeType for ElevenLabs responses", async () => {
      mockTtsResponse("AAAA", "audio/mpeg");
      const result = await requestTTS({ word: "hello" });
      expect(result.mimeType).toBe("audio/mpeg");
    });

    it("sends word and provider in request body", async () => {
      mockTtsResponse();
      await requestTTS({ word: "hello", voice: "Aoede" });
      const body = JSON.parse((fetch as any).mock.calls[0][1].body);
      expect(body.word).toBe("hello");
      expect(body.voice).toBe("Aoede");
      expect(body.provider).toBe("gemini");
    });

    it("uses /api/tts endpoint without hardcoded provider URLs", async () => {
      mockTtsResponse();
      await requestTTS({ word: "test" });
      const url = (fetch as any).mock.calls[0][0];
      expect(url).toBe("/api/tts");
      expect(url).not.toContain("googleapis.com");
    });
  });
});
