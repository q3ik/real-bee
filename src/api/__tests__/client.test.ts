/**
 * Tests for src/api/client.ts — base apiRequest function.
 *
 * Verifies:
 *  - Successful JSON responses
 *  - ApiError on non-2xx responses
 *  - TimeoutError on request timeouts
 *  - Retry logic with exponential backoff
 *  - Network error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiRequest } from "../client";
import { ApiError, TimeoutError } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchOk(payload: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(payload),
  } as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockFetchError(
  status: number,
  errorBody?: { error: string },
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve(errorBody ?? { error: "API error" }),
  } as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockFetchNetworkError(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Mock fetch that respects AbortSignal — rejects when signal is aborted */
function mockFetchHangsRespectingSignal(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockImplementation(
    (_url: string, init: RequestInit) =>
      new Promise<never>((_, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("apiRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // Successful responses
  // -------------------------------------------------------------------------

  describe("successful responses", () => {
    it("returns parsed JSON on 200 response", async () => {
      mockFetchOk({ transcript: "hello" });

      const result = await apiRequest<{ transcript: string }>("/api/stt", {
        audio: "base64",
        mimeType: "audio/webm",
      });

      expect(result).toEqual({ transcript: "hello" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/stt",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: "base64", mimeType: "audio/webm" }),
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("serializes request body as JSON", async () => {
      mockFetchOk({ success: true });

      await apiRequest("/api/tts", { word: "apple", voice: "Aoede" });

      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].body).toBe(
        JSON.stringify({ word: "apple", voice: "Aoede" }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    it("throws ApiError on non-2xx response with error message from body", async () => {
      mockFetchError(500, { error: "TTS generation failed" });

      await expect(apiRequest("/api/tts", { word: "apple" })).rejects.toThrow(
        ApiError,
      );

      try {
        await apiRequest("/api/tts", { word: "apple" });
      } catch (error) {
        expect(error).toMatchObject({
          status: 500,
          message: "TTS generation failed",
          endpoint: "/api/tts",
        });
      }
    });

    it("throws ApiError with generic message when error body is unparseable", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.reject(new Error("not json")),
      } as unknown as Response);
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        apiRequest("/api/stt", { audio: "x", mimeType: "audio/webm" }),
      ).rejects.toMatchObject({
        status: 503,
        message: "API error: 503",
        endpoint: "/api/stt",
      });
    });

    it("throws ApiError on network failure", async () => {
      mockFetchNetworkError();

      await expect(apiRequest("/api/tts", { word: "apple" })).rejects.toThrow(
        ApiError,
      );

      try {
        await apiRequest("/api/tts", { word: "apple" });
      } catch (error) {
        expect(error).toMatchObject({
          status: 0,
          endpoint: "/api/tts",
        });
      }
    });
  });

  // -------------------------------------------------------------------------
  // Timeout handling
  // -------------------------------------------------------------------------

  describe("timeout handling", () => {
    it("throws TimeoutError when request exceeds timeout", async () => {
      mockFetchHangsRespectingSignal();

      await expect(
        apiRequest(
          "/api/stt",
          { audio: "x", mimeType: "audio/webm" },
          { timeoutMs: 50 },
        ),
      ).rejects.toThrow(TimeoutError);
    }, 5000);

    it("TimeoutError message includes timeout duration", async () => {
      mockFetchHangsRespectingSignal();

      try {
        await apiRequest("/api/tts", { word: "apple" }, { timeoutMs: 50 });
      } catch (error) {
        expect((error as TimeoutError).message).toContain("50ms");
        return;
      }
      expect.fail("Expected TimeoutError to be thrown");
    }, 5000);
  });

  // -------------------------------------------------------------------------
  // Retry logic
  // -------------------------------------------------------------------------

  describe("retry logic", () => {
    it("retries on failure and succeeds on second attempt", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ error: "Service unavailable" }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ transcript: "hello" }),
        } as Response);
      vi.stubGlobal("fetch", fetchMock);

      const result = await apiRequest<{ transcript: string }>(
        "/api/stt",
        { audio: "x", mimeType: "audio/webm" },
        { retries: 2, retryDelayMs: 10 },
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ transcript: "hello" });
    });

    it("exhausts retries and throws last error", async () => {
      mockFetchError(500);

      await expect(
        apiRequest(
          "/api/tts",
          { word: "apple" },
          { retries: 2, retryDelayMs: 10 },
        ),
      ).rejects.toThrow(ApiError);

      // Initial attempt + 2 retries = 3 total calls
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("applies exponential backoff between retries", async () => {
      mockFetchError(503);

      const startTime = Date.now();

      await expect(
        apiRequest(
          "/api/stt",
          { audio: "x", mimeType: "audio/webm" },
          { retries: 2, retryDelayMs: 50 },
        ),
      ).rejects.toThrow(ApiError);

      const elapsed = Date.now() - startTime;
      // Should have waited: 50ms (delay 1) + 100ms (delay 2) = 150ms minimum
      // Allow some margin for test execution overhead
      expect(elapsed).toBeGreaterThanOrEqual(130);
    }, 5000);
  });

  // -------------------------------------------------------------------------
  // No hardcoded values
  // -------------------------------------------------------------------------

  describe("no hardcoded values", () => {
    it("uses endpoint parameter for URL (no hardcoded URLs)", async () => {
      mockFetchOk({ ok: true });

      await apiRequest("/api/custom-endpoint", { data: "test" });

      expect(fetch).toHaveBeenCalledWith(
        "/api/custom-endpoint",
        expect.any(Object),
      );
    });
  });
});
