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

type GeminiAction = 'tts' | 'stt' | 'hint';
const VALID_ACTIONS: GeminiAction[] = ['tts', 'stt', 'hint'];

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

  // Reconstruct request without the `action` field so each downstream
  // handler receives its normal payload shape unchanged.
  const newRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(rest),
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
