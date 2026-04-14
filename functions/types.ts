/**
 * Shared type definitions for Cloudflare Pages Functions
 */

/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare environment bindings (from wrangler.toml)
 */
export interface Env {
  DB: D1Database;
  /** Cloudflare AI binding for running Whisper models */
  AI?: Ai;
  GEMINI_API_KEY: string;
  /** ElevenLabs API key for Flash v2.5 TTS */
  ELEVENLABS_API_KEY?: string;
  /** Deepgram API key for Nova-3 STT */
  DEEPGRAM_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
  /** TTS provider selection: 'gemini' (default) | 'elevenlabs' */
  TTS_PROVIDER?: string;
  /** STT provider selection: 'gemini' (default) | 'cloudflare-whisper' | 'deepgram' */
  STT_PROVIDER?: string;
}

export type PagesContext = EventContext<Env, string, Record<string, unknown>>;
