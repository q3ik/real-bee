/**
 * TTS client with provider strategy and automatic browser fallback.
 *
 * Provider selection is driven by VITE_TTS_PROVIDER env var:
 *  - 'gemini' (default) → POST /api/tts (Gemini TTS via Cloudflare Worker)
 *  - 'elevenlabs' → POST /api/tts (ElevenLabs via Cloudflare Worker)
 *
 * If the primary provider fails, falls back to browser speechSynthesis
 * which returns an empty ArrayBuffer (audio is played natively).
 * A 'tts-unavailable' CustomEvent is dispatched on window so the UI can
 * surface a visible indicator rather than silently producing no audio (QA fix #5).
 */

import { apiRequest } from "./client";
import type { TtsRequest, TtsResponse } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default TTS endpoint path (resolved via Cloudflare Worker proxy) */
const TTS_ENDPOINT = "/api/tts";

/** Default request timeout for TTS (ms) */
const TTS_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Provider Selection
// ---------------------------------------------------------------------------

/**
 * Get the configured TTS provider from environment variables.
 * Defaults to 'gemini' if not set.
 */
export function getTtsProvider(): string {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return (import.meta.env.VITE_TTS_PROVIDER as string) ?? "gemini";
  }
  return "gemini";
}

// ---------------------------------------------------------------------------
// Browser Fallback
// ---------------------------------------------------------------------------

/**
 * Speak text using the browser's native speechSynthesis API.
 * Returns an empty ArrayBuffer since audio is played natively.
 */
function speakBrowserFallback(text: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      reject(new Error("Browser speechSynthesis not available"));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => resolve(new ArrayBuffer(0));
    utterance.onerror = () => reject(new Error("SpeechSynthesis failed"));

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Dispatch a 'tts-unavailable' event on window so UI components can
 * react (e.g. show a banner) without polling or prop-drilling.
 * No-op in non-browser environments.
 */
function notifyTtsUnavailable(provider: string, reason: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("tts-unavailable", {
      detail: { provider, reason },
      bubbles: false,
    }),
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Request text-to-speech synthesis.
 *
 * @param request - The TTS request containing word and optional voice
 * @returns Object containing the audio ArrayBuffer and its mimeType
 * @throws ApiError if the primary provider fails and browser fallback is unavailable
 */
export async function requestTTS(request: TtsRequest): Promise<{
  audioBuffer: ArrayBuffer;
  mimeType: string;
}> {
  const provider = getTtsProvider();

  try {
    const response = await apiRequest<TtsResponse>(
      TTS_ENDPOINT,
      { ...request, provider },
      { timeoutMs: TTS_TIMEOUT_MS, retries: 1 },
    );

    // Decode base64 audio to ArrayBuffer
    const audioData = Uint8Array.from(atob(response.audio), (c) =>
      c.charCodeAt(0),
    );
    return { audioBuffer: audioData.buffer, mimeType: response.mimeType };
  } catch (error) {
    // Log the primary provider failure for debugging
    const errorMsg = (error as Error)?.message ?? String(error);
    if (
      !(
        errorMsg.includes("429") ||
        errorMsg.includes("quota") ||
        errorMsg.includes("Failed to fetch") ||
        errorMsg.includes("NetworkError")
      )
    ) {
      console.warn(`[TTS] Primary provider (${provider}) failed:`, errorMsg);
    }

    // Notify the UI that TTS is unavailable so it can surface a visible
    // indicator instead of silently playing nothing (QA fix #5).
    notifyTtsUnavailable(provider, errorMsg);

    // Fall back to browser speechSynthesis
    const fallbackBuffer = await speakBrowserFallback(request.word);
    return { audioBuffer: fallbackBuffer, mimeType: "audio/pcm" };
  }
}
