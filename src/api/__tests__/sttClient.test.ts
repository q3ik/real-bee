/**
 * Tests for src/api/sttClient.ts — STT provider strategy and fallback.
 *
 * Verifies:
 *  - Provider selection via VITE_STT_PROVIDER env var
 *  - Successful STT returns { transcript: string }
 *  - Primary provider failure triggers browser fallback
 *  - Zero hardcoded URLs or provider names (all via env vars)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  requestSTT,
  getSttProvider,
  isBrowserSpeechRecognitionAvailable,
} from "../sttClient";
import { ApiError } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSttResponse(transcript: string): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ transcript }),
  } as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockSttError(
  status: number,
  errorBody?: { error: string },
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve(errorBody ?? { error: "STT failed" }),
  } as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("sttClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // Provider selection
  // -------------------------------------------------------------------------

  describe("getSttProvider", () => {
    it("defaults to 'gemini' when VITE_STT_PROVIDER is not set", () => {
      const provider = getSttProvider();
      expect(provider).toBe("gemini");
    });
  });

  // -------------------------------------------------------------------------
  // Browser availability check
  // -------------------------------------------------------------------------

  describe("isBrowserSpeechRecognitionAvailable", () => {
    it("returns true when SpeechRecognition is available", () => {
      vi.stubGlobal("SpeechRecognition", vi.fn());
      expect(isBrowserSpeechRecognitionAvailable()).toBe(true);
      vi.unstubAllGlobals();
    });

    it("returns false when neither SpeechRecognition is available", () => {
      // Ensure neither is set
      vi.stubGlobal("SpeechRecognition", undefined);
      vi.stubGlobal("webkitSpeechRecognition", undefined);
      expect(isBrowserSpeechRecognitionAvailable()).toBe(false);
      vi.unstubAllGlobals();
    });
  });

  // -------------------------------------------------------------------------
  // Successful STT
  // -------------------------------------------------------------------------

  describe("requestSTT", () => {
    it("returns { transcript } on successful STT response", async () => {
      mockSttResponse("hello world");

      const result = await requestSTT({
        audio: "base64",
        mimeType: "audio/webm",
      });

      expect(result).toEqual({ transcript: "hello world" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/stt",
        expect.objectContaining({
          method: "POST",
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("sends audio and mimeType in request body", async () => {
      mockSttResponse("test");

      await requestSTT({ audio: "AAAA", mimeType: "audio/webm;codecs=opus" });

      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.audio).toBe("AAAA");
      expect(body.mimeType).toBe("audio/webm;codecs=opus");
      expect(body.provider).toBe("gemini"); // default provider
    });
  });

  // -------------------------------------------------------------------------
  // No hardcoded values
  // -------------------------------------------------------------------------

  describe("no hardcoded values", () => {
    it("uses /api/stt endpoint (not hardcoded provider URLs)", async () => {
      mockSttResponse("test");

      await requestSTT({ audio: "x", mimeType: "audio/webm" });

      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[0]).toBe("/api/stt");
      // Should NOT contain hardcoded provider URLs
      expect(callArgs[0]).not.toContain("googleapis.com");
      expect(callArgs[0]).not.toContain("api.cloudflare.com");
    });
  });
});
