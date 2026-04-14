/**
 * Shared type definitions for the typed HTTP client layer.
 *
 * Centralizes error handling, request/response shapes, and provider
 * configuration for TTS and STT services.
 */

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

/**
 * Typed API error thrown by `apiRequest` on non-2xx responses or timeouts.
 * Contains the HTTP status, endpoint, and a human-readable message.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Timeout error — a specialization of ApiError for request timeouts.
 */
export class TimeoutError extends ApiError {
  constructor(endpoint: string, timeoutMs: number, cause?: unknown) {
    super(`Request timed out after ${timeoutMs}ms`, 408, endpoint, cause);
    this.name = "TimeoutError";
  }
}

// ---------------------------------------------------------------------------
// Request / Response Types — TTS
// ---------------------------------------------------------------------------

/** TTS provider identifiers. Driven by VITE_TTS_PROVIDER env var. */
export type TtsProvider = "gemini" | "elevenlabs";

/** Request shape for TTS endpoints */
export interface TtsRequest {
  /** Text to synthesize (single word or short phrase) */
  word: string;
  /** Optional voice identifier (provider-specific) */
  voice?: string;
}

/** Response shape from TTS endpoints */
export interface TtsResponse {
  /** Base-64 encoded audio */
  audio: string;
  /** MIME type of the audio (e.g., 'audio/pcm') */
  mimeType: string;
  /** Sample rate in Hz (default: 24000) */
  sampleRate?: number;
}

// ---------------------------------------------------------------------------
// Request / Response Types — STT
// ---------------------------------------------------------------------------

/** STT provider identifiers. Driven by VITE_STT_PROVIDER env var. */
export type SttProvider = "gemini" | "cloudflare-whisper" | "deepgram";

/** Request shape for STT endpoints */
export interface SttRequest {
  /** Base-64 encoded audio blob */
  audio: string;
  /** MIME type of the audio (e.g., 'audio/webm') */
  mimeType: string;
}

/** Response shape from STT endpoints */
export interface SttResponse {
  /** Transcribed text */
  transcript: string;
}

// ---------------------------------------------------------------------------
// Provider Configuration
// ---------------------------------------------------------------------------

/**
 * Provider selection and fallback configuration.
 * Primary provider is selected via env vars; fallbacks are automatic.
 */
export interface ProviderConfig {
  /** Primary provider (from VITE_TTS_PROVIDER or VITE_STT_PROVIDER) */
  primary: string;
  /** Whether browser-native fallback is enabled */
  browserFallback: boolean;
}
