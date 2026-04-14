/**
 * STT client with provider strategy and automatic browser fallback.
 *
 * Provider selection is driven by VITE_STT_PROVIDER env var:
 *  - 'gemini' (default) → POST /api/stt (Gemini STT via Cloudflare Worker)
 *  - 'cloudflare-whisper' → POST /api/stt (Cloudflare Whisper via Worker)
 *  - 'deepgram' → POST /api/stt (Deepgram Nova-3 via Worker)
 *
 * If the primary provider fails, falls back to browser SpeechRecognition
 * which is handled entirely client-side.
 */

import { apiRequest } from "./client";
import type { SttRequest, SttResponse } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default STT endpoint path (resolved via Cloudflare Worker proxy) */
const STT_ENDPOINT = "/api/stt";

/** Default request timeout for STT (ms) */
const STT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Provider Selection
// ---------------------------------------------------------------------------

/**
 * Get the configured STT provider from environment variables.
 * Defaults to 'gemini' if not set.
 */
export function getSttProvider(): string {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return (import.meta.env.VITE_STT_PROVIDER as string) ?? "gemini";
  }
  return "gemini";
}

// ---------------------------------------------------------------------------
// Browser Fallback
// ---------------------------------------------------------------------------

/**
 * Check whether browser SpeechRecognition is available.
 */
export function isBrowserSpeechRecognitionAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    )
  );
}

/**
 * Recognize speech using the browser's native SpeechRecognition API.
 * Returns a promise that resolves with the transcript.
 */
function recognizeBrowserSpeech(): Promise<string> {
  return new Promise((resolve, reject) => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      reject(new Error("Browser SpeechRecognition not available"));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      resolve(transcript.trim().toLowerCase());
    };

    recognition.onerror = (event: any) => {
      reject(new Error(`SpeechRecognition error: ${event.error}`));
    };

    recognition.onend = () => {
      // If no result was produced, reject
      reject(new Error("SpeechRecognition ended without result"));
    };

    try {
      recognition.start();
    } catch (error) {
      reject(error);
    }
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Request speech-to-text transcription.
 *
 * @param request - The STT request containing audio and mimeType
 * @returns Object containing the transcript string
 * @throws ApiError if the primary provider fails and browser fallback is unavailable
 */
export async function requestSTT(request: SttRequest): Promise<SttResponse> {
  const provider = getSttProvider();

  try {
    return await apiRequest<SttResponse>(
      STT_ENDPOINT,
      { ...request, provider },
      { timeoutMs: STT_TIMEOUT_MS, retries: 1 },
    );
  } catch (error) {
    const errorMsg = (error as Error)?.message ?? String(error);
    console.warn(`[STT] Primary provider (${provider}) failed:`, errorMsg);

    // Fall back to browser SpeechRecognition
    if (isBrowserSpeechRecognitionAvailable()) {
      const transcript = await recognizeBrowserSpeech();
      return { transcript };
    }

    // No fallback available — re-throw
    throw error;
  }
}
