/**
 * Cloudflare Pages Function: Text-to-Speech via Gemini
 *
 * Route: /api/tts
 * Method: POST
 *
 * Request body: { word: string, voice?: string }
 * Response: { audio: string (base64), mimeType: string }
 *
 * Model, voice defaults, and generation config are hardcoded server-side.
 * The client cannot influence model selection or audio parameters.
 */
import { getAllowedOrigins, corsHeaders, isOriginAllowed, onRequestOptions } from '../_middleware.js';
export { onRequestOptions };
import type { PagesContext } from '../types.js';

const VALID_VOICES = ['Aoede', 'Charon', 'Fenrir', 'Kore', 'Puck'] as const;
type GeminiVoice = typeof VALID_VOICES[number];
const DEFAULT_VOICE: GeminiVoice = 'Aoede';

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

  const { word, voice } = body;

  if (!word || typeof word !== 'string' || word.trim().length === 0) {
    return json({ error: 'Missing or invalid "word" field' }, 400, origin);
  }
  if ((word as string).trim().length > 200) {
    return json({ error: '"word" exceeds maximum length of 200 characters' }, 400, origin);
  }
  if (voice !== undefined && !VALID_VOICES.includes(voice as GeminiVoice)) {
    return json(
      { error: `Invalid "voice" — must be one of: ${VALID_VOICES.join(', ')}` },
      400,
      origin
    );
  }

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'TTS service not configured' }, 503, origin);
  }

  const selectedVoice = (voice as GeminiVoice | undefined) ?? DEFAULT_VOICE;
  const trimmedWord = (word as string).trim();

  try {
    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: trimmedWord }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errorBody = await geminiRes.text();
      console.error('[tts] Gemini API error:', geminiRes.status, errorBody);
      throw new Error(`Gemini TTS error: ${geminiRes.status}`);
    }

    const data = (await geminiRes.json()) as {
      candidates: Array<{
        content: { parts: Array<{ inlineData?: { data: string; mimeType: string } }> };
      }>;
    };
    const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;

    if (!inlineData?.data) {
      throw new Error('No audio data in Gemini TTS response');
    }

    const ALLOWED_AUDIO_TYPES = ['audio/wav', 'audio/pcm', 'audio/mpeg', 'audio/mp3', 'audio/ogg'] as const;
    const responseMimeType = inlineData.mimeType ?? 'audio/wav';
    if (!ALLOWED_AUDIO_TYPES.includes(responseMimeType as typeof ALLOWED_AUDIO_TYPES[number])) {
      console.error('[tts] Unexpected mimeType from Gemini:', responseMimeType);
      throw new Error(`Unexpected audio mimeType: ${responseMimeType}`);
    }

    return json({ audio: inlineData.data, mimeType: responseMimeType }, 200, origin);
  } catch (error) {
    console.error('[tts] Error:', error);
    return json({ error: 'TTS generation failed' }, 500, origin);
  }
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
