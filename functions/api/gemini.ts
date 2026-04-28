/**
 * Cloudflare Pages Function: Unified Gemini proxy
 *
 * Route: /api/gemini
 * Method: POST
 *
 * Request body: { action: 'tts' | 'stt' | 'hint', ...actionPayload }
 *
 * The `action` field is stripped before the request is forwarded to the
 * individual handler so each handler receives its normal payload shape:
 *   tts  → { word, voice? }
 *   stt  → { audio, mimeType }
 *   hint → { word, type }
 *
 * Individual routes (/api/tts, /api/stt, /api/hint) are kept for
 * direct access but all client code should prefer /api/gemini.
 */
import {
  getAllowedOrigins,
  corsHeaders,
  isOriginAllowed,
  onRequestOptions,
} from '../_middleware.js';
export { onRequestOptions };

import { onRequestPost as ttsHandler } from './tts.js';
import { onRequestPost as sttHandler } from './stt.js';
import { onRequestPost as hintHandler } from './hint.js';
import type { PagesContext } from '../types.js';
import { z } from 'zod';

type GeminiAction = 'tts' | 'stt' | 'hint';
const VALID_ACTIONS: GeminiAction[] = ['tts', 'stt', 'hint'];

const ACTION_SCHEMAS: Record<GeminiAction, z.ZodTypeAny> = {
  tts: z.object({
    word: z.string().min(1),
    voice: z.string().optional(),
    provider: z.string().optional(),
  }),
  stt: z.object({
    // Require non-empty strings — empty audio/mimeType would produce a
    // meaningless Cloudflare AI / Deepgram call and an opaque downstream error.
    audio: z.string().min(1),
    mimeType: z.string().min(1),
    provider: z.string().optional(),
  }),
  hint: z.object({
    word: z.string().min(1),
    type: z.string().min(1),
  }),
};

export { ACTION_SCHEMAS };

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = getAllowedOrigins(env);

  if (!isOriginAllowed(origin, allowedOrigins)) {
    return json({ error: 'Origin not allowed' }, 403, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON in request body' }, 400, origin);
  }

  const { action, ...rest } = body;

  if (!action || !VALID_ACTIONS.includes(action as GeminiAction)) {
    return json(
      { error: `Invalid "action" — must be one of: ${VALID_ACTIONS.join(', ')}` },
      400,
      origin
    );
  }

  // Validate the action-specific payload against its schema before forwarding.
  const schema = ACTION_SCHEMAS[action as GeminiAction];
  const parsed = schema.safeParse(rest);
  if (!parsed.success) {
    return json(
      { error: 'Invalid request payload', details: parsed.error.format() },
      400,
      origin
    );
  }

  // Reconstruct request without the `action` field so each downstream
  // handler receives its normal payload shape unchanged.
  const newRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(parsed.data),
  }) as PagesContext['request'];

  const newContext: PagesContext = { ...context, request: newRequest };

  switch (action as GeminiAction) {
    case 'tts':
      return ttsHandler(newContext);
    case 'stt':
      return sttHandler(newContext);
    case 'hint':
      return hintHandler(newContext);
  }
}
