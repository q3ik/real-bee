/**
 * Gemini proxy client
 *
 * All Gemini API calls from the browser must go through this module.
 * Requests are routed to the Cloudflare Worker at /api/gemini so the
 * GEMINI_API_KEY secret never leaves the server.
 *
 * Usage:
 *   import { gemini } from '../lib/geminiClient';
 *   const audio = await gemini.tts({ word: 'elephant' });
 *   const text  = await gemini.stt({ audio: base64, mimeType: 'audio/webm' });
 *   const hint  = await gemini.hint({ word: 'elephant', type: 'definition' });
 */

import { Sentry } from './sentry';

const PROXY_URL = '/api/gemini';

// ---------------------------------------------------------------------------
// Request / Response types (mirror the Worker's expected payload shapes)
// ---------------------------------------------------------------------------

export interface TtsRequest {
  word: string;
  voice?: string;
}

export interface TtsResponse {
  /** Base-64 encoded audio (MP3 or WAV depending on Worker config) */
  audio: string;
  mimeType: string;
}

export interface SttRequest {
  /** Base-64 encoded audio blob */
  audio: string;
  mimeType: string;
}

export interface SttResponse {
  transcript: string;
}

/**
 * Hint types accepted by the /api/hint Worker.
 * Must stay in sync with VALID_TYPES in functions/api/hint.ts.
 */
export type HintType = 'definition' | 'usage' | 'origin';

export interface HintRequest {
  word: string;
  type: HintType;
}

export interface HintResponse {
  hint: string;
}

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

async function post<TReq, TRes>(
  action: 'tts' | 'stt' | 'hint',
  payload: TReq,
): Promise<TRes> {
  let res: Response;

  // -------------------------------------------------------------------------
  // Network-level errors (offline / DNS failure / worker unreachable)
  // fetch() rejects before we ever have a Response object.  These are the
  // most common real-world failure mode and must be captured separately from
  // the !res.ok branch below which handles HTTP 4xx/5xx responses.
  // -------------------------------------------------------------------------
  try {
    res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch (networkError) {
    Sentry.captureException(networkError, {
      level: 'warning',
      tags: {
        'gemini.action': action,
        // status '0' mirrors the convention used in apiRequest and makes
        // Sentry filters consistent across both clients.
        'gemini.status': '0',
      },
    });
    throw networkError;
  }

  // -------------------------------------------------------------------------
  // HTTP error responses (4xx / 5xx)
  // -------------------------------------------------------------------------
  if (!res.ok) {
    let message = `Gemini proxy error: ${res.status}`;
    try {
      const err = (await res.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch {
      // ignore parse failures — the status code is enough
    }
    const error = new Error(message);
    // 4xx/5xx are genuine server/config errors — always use 'error' level.
    Sentry.captureException(error, {
      level: 'error',
      tags: { 'gemini.action': action, 'gemini.status': String(res.status) },
    });
    throw error;
  }

  return res.json() as Promise<TRes>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const gemini = {
  /**
   * Text-to-speech: returns base-64 encoded audio for the given word.
   * Use audioManager to decode and play the result.
   */
  tts: (req: TtsRequest): Promise<TtsResponse> =>
    post<TtsRequest, TtsResponse>('tts', req),

  /**
   * Speech-to-text: transcribes a base-64 encoded audio blob.
   * Pass the raw blob from MediaRecorder encoded as base-64.
   */
  stt: (req: SttRequest): Promise<SttResponse> =>
    post<SttRequest, SttResponse>('stt', req),

  /**
   * Hint generation: returns a contextual hint for the given word.
   * type: 'definition' | 'usage' | 'origin'
   * Must match VALID_TYPES in functions/api/hint.ts.
   */
  hint: (req: HintRequest): Promise<HintResponse> =>
    post<HintRequest, HintResponse>('hint', req),
} as const;
