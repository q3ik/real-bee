/**
 * Cloudflare Pages Function: Speech-to-Text via Gemini
 *
 * Route: /api/stt
 * Method: POST
 *
 * Request body: { audio: string (base64), mimeType: string }
 * Response: { transcript: string }
 *
 * System prompt and generation config are hardcoded server-side.
 * The client cannot influence model selection or transcription behavior.
 */
import { getAllowedOrigins, corsHeaders, isOriginAllowed, onRequestOptions } from '../_middleware.js';
export { onRequestOptions };
import type { PagesContext } from '../types.js';

// MIME type matching is intentionally strict (no space-normalization).
// Browser MediaRecorder typically emits 'audio/webm;codecs=opus' (no space).
// RFC-valid variants with spaces (e.g. 'audio/webm; codecs=opus') are not accepted
// to keep validation simple and deterministic.
const ALLOWED_MIME_TYPES = [
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/mp4',
  'audio/wav',
  'audio/mpeg',
] as const;

type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

const STT_SYSTEM_PROMPT =
  'You are a spelling bee judge. The user has spoken a word. ' +
  'Transcribe exactly the word you hear — return only the single word, lowercase, no punctuation, nothing else.';

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

  const { audio, mimeType } = body;

  if (!audio || typeof audio !== 'string' || audio.trim().length === 0) {
    return json({ error: 'Missing or invalid "audio" field (expected base64 string)' }, 400, origin);
  }
  const MAX_AUDIO_BASE64_LENGTH = 512 * 1024; // ~384 KB binary
  if ((audio as string).length > MAX_AUDIO_BASE64_LENGTH) {
    return json({ error: '"audio" exceeds maximum size (512 KB base64)' }, 400, origin);
  }
  if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
    return json(
      { error: `Invalid "mimeType" — must be one of: ${ALLOWED_MIME_TYPES.join(', ')}` },
      400,
      origin
    );
  }

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'STT service not configured' }, 503, origin);
  }

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
          system_instruction: { parts: [{ text: STT_SYSTEM_PROMPT }] },
          contents: [
            {
              parts: [
                { inlineData: { mimeType: mimeType as string, data: audio as string } },
                { text: 'What word was spoken?' },
              ],
            },
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 20 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errorBody = await geminiRes.text();
      console.error('[stt] Gemini API error:', geminiRes.status, errorBody);
      throw new Error(`Gemini STT error: ${geminiRes.status}`);
    }

    const data = (await geminiRes.json()) as {
      candidates: Array<{ content: { parts: Array<{ text?: string }> } }>;
    };
    const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    if (!transcript) {
      throw new Error('Empty transcript from Gemini');
    }

    return json({ transcript }, 200, origin);
  } catch (error) {
    console.error('[stt] Error:', error);
    return json({ error: 'Transcription failed' }, 500, origin);
  }
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
