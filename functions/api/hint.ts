/**
 * Cloudflare Pages Function: AI-powered word hints
 *
 * Route: /api/hint
 * Method: POST
 *
 * Request body: { word: string, type: 'definition' | 'usage' | 'origin' }
 * Response: { hint: string }
 *
 * Model, system prompts, and generation parameters are hardcoded server-side.
 * The client cannot influence model selection, temperature, or token limits.
 */
import { getAllowedOrigins, corsHeaders, isOriginAllowed, onRequestOptions } from '../_middleware.js';
export { onRequestOptions };
import type { PagesContext } from '../types.js';

type HintType = 'definition' | 'usage' | 'origin';
const VALID_TYPES: HintType[] = ['definition', 'usage', 'origin'];

const SYSTEM_PROMPTS: Record<HintType, string> = {
  definition:
    'You are a spelling teacher. Given a word, provide a concise definition in 1–2 sentences suitable for a student. Do not use the target word in your definition.',
  usage:
    'You are a spelling teacher. Given a word, provide a single natural example sentence using that word correctly.',
  origin:
    'You are a spelling teacher. Given a word, briefly explain its language of origin or etymology in 1–2 sentences.',
};

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

  const { word, type } = body;

  if (!word || typeof word !== 'string' || word.trim().length === 0) {
    return json({ error: 'Missing or invalid "word" field' }, 400, origin);
  }
  if ((word as string).trim().length > 100) {
    return json({ error: '"word" exceeds maximum length of 100 characters' }, 400, origin);
  }
  if (!type || !VALID_TYPES.includes(type as HintType)) {
    return json(
      { error: 'Invalid "type" field — must be definition, usage, or origin' },
      400,
      origin
    );
  }

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'Hint service not configured' }, 503, origin);
  }

  const trimmedWord = (word as string).trim();
  const hintType = type as HintType;

  try {
    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPTS[hintType] }] },
          contents: [{ parts: [{ text: trimmedWord }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 150 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errorBody = await geminiRes.text();
      console.error('[hint] Gemini API error:', geminiRes.status, errorBody);
      throw new Error(`Gemini API error: ${geminiRes.status}`);
    }

    const data = (await geminiRes.json()) as {
      candidates: Array<{
        finishReason?: string;
        content: { parts: Array<{ text: string }> };
      }>;
    };
    const candidate = data.candidates?.[0];
    const finishReason = candidate?.finishReason;

    if (finishReason === 'SAFETY') {
      return json({ error: 'Hint unavailable for this word' }, 422, origin);
    }

    const hint = candidate?.content?.parts?.[0]?.text?.trim() ?? '';

    if (!hint) {
      throw new Error('Empty response from Gemini');
    }

    // Log hint event to D1 (non-fatal)
    try {
      await env.DB.prepare(
        'INSERT INTO hint_events (session_id, user_id, word, hint_type, created_at) VALUES (?, ?, ?, ?, unixepoch())'
      )
        .bind(null, 'anonymous', trimmedWord, hintType)
        .run();
    } catch {
      console.error('[hint] Failed to log hint event to D1');
    }

    return json({ hint }, 200, origin);
  } catch (error) {
    console.error('[hint] Generation error:', error);
    return json({ error: 'Hint generation failed' }, 500, origin);
  }
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
