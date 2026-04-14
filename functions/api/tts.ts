/**
 * Cloudflare Pages Function: Text-to-Speech via Gemini or ElevenLabs
 *
 * Route: /api/tts
 * Method: POST
 *
 * Request body: { word: string, voice?: string, provider?: string }
 * Response: { audio: string (base64 PCM), mimeType: 'audio/pcm', sampleRate: 24000 }
 *
 * Provider selection precedence (most → least authoritative):
 *   1. env.TTS_PROVIDER  — operator configuration, always wins
 *   2. request body 'provider' field — client hint, honoured only if env is unset
 *   3. 'gemini' — hard default
 *
 * The client-supplied provider field is validated but cannot override the
 * operator's env setting. This prevents a client from forcing a more expensive
 * or restricted provider against operator intent.
 *
 * Model, voice defaults, and generation config are hardcoded server-side.
 * The client cannot influence model selection or audio parameters.
 */
import {
  getAllowedOrigins,
  corsHeaders,
  isOriginAllowed,
  onRequestOptions,
} from "../_middleware.js";
export { onRequestOptions };
import type { PagesContext } from "../types.js";

const VALID_VOICES = ["Aoede", "Charon", "Fenrir", "Kore", "Puck"] as const;
type GeminiVoice = (typeof VALID_VOICES)[number];
const DEFAULT_VOICE: GeminiVoice = "Aoede";

/** Default ElevenLabs voice ID (Rachel) */
const ELEVENLABS_DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

/** Valid provider identifiers */
const VALID_PROVIDERS = ["gemini", "elevenlabs"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

/** Maximum allowed word length for ElevenLabs (chars) */
const MAX_WORD_LENGTH = 500;

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = getAllowedOrigins(env);

  if (!isOriginAllowed(origin, allowedOrigins)) {
    return json({ error: "Origin not allowed" }, 403, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON in request body" }, 400, origin);
  }

  const { word, voice, provider: requestedProvider } = body;

  if (!word || typeof word !== "string" || word.trim().length === 0) {
    return json({ error: 'Missing or invalid "word" field' }, 400, origin);
  }

  // Provider selection: server env takes priority over client hint (QA fix #6).
  const selectedProvider: Provider =
    (env.TTS_PROVIDER as Provider) ??
    (requestedProvider as Provider) ??
    "gemini";

  // Word length limit: ElevenLabs has a 500-char limit; Gemini has no hard
  // limit but we enforce the same cap for consistency.
  if ((word as string).trim().length > MAX_WORD_LENGTH) {
    return json(
      {
        error: `"word" exceeds maximum length of ${MAX_WORD_LENGTH} characters`,
      },
      400,
      origin,
    );
  }

  // Voice validation only applies to Gemini voices
  if (
    selectedProvider === "gemini" &&
    voice !== undefined &&
    !VALID_VOICES.includes(voice as GeminiVoice)
  ) {
    return json(
      { error: `Invalid "voice" — must be one of: ${VALID_VOICES.join(", ")}` },
      400,
      origin,
    );
  }

  if (
    requestedProvider !== undefined &&
    !VALID_PROVIDERS.includes(requestedProvider as Provider)
  ) {
    return json(
      {
        error: `Invalid "provider" — must be one of: ${VALID_PROVIDERS.join(", ")}`,
      },
      400,
      origin,
    );
  }

  const selectedVoice = (voice as GeminiVoice | undefined) ?? DEFAULT_VOICE;
  const trimmedWord = (word as string).trim();

  try {
    // Route to the selected provider
    if (selectedProvider === "elevenlabs") {
      return await handleElevenLabs(trimmedWord, env, origin);
    }

    // Default: Gemini TTS — guard only applies when no other provider is
    // configured. This allows ElevenLabs to work independently of Gemini.
    if (!env.GEMINI_API_KEY) {
      return json({ error: "Gemini TTS not configured" }, 503, origin);
    }

    return await handleGemini(trimmedWord, selectedVoice, env, origin);
  } catch (error) {
    console.error("[tts] Error:", error);
    return json({ error: "TTS generation failed" }, 500, origin);
  }
}

/** Handle ElevenLabs Flash v2.5 TTS */
async function handleElevenLabs(
  word: string,
  env: PagesContext["env"],
  origin: string,
): Promise<Response> {
  if (!env.ELEVENLABS_API_KEY) {
    return json({ error: "ElevenLabs TTS not configured" }, 503, origin);
  }

  const voiceId = ELEVENLABS_DEFAULT_VOICE;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": env.ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text: word,
      model_id: "eleven_flash_v2_5",
      output_format: "mp3_44100_128",
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("[tts] ElevenLabs API error:", res.status, errorBody);
    throw new Error(`ElevenLabs TTS error: ${res.status}`);
  }

  // ElevenLabs returns MP3 audio directly — convert to base64
  const arrayBuffer = await res.arrayBuffer();
  const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

  return json(
    { audio: base64Audio, mimeType: "audio/mpeg", sampleRate: 44100 },
    200,
    origin,
  );
}

/** Handle Gemini TTS */
async function handleGemini(
  word: string,
  voice: GeminiVoice,
  env: PagesContext["env"],
  origin: string,
): Promise<Response> {
  const geminiRes = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: word }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      }),
    },
  );

  if (!geminiRes.ok) {
    const errorBody = await geminiRes.text();
    console.error("[tts] Gemini API error:", geminiRes.status, errorBody);
    throw new Error(`Gemini TTS error: ${geminiRes.status}`);
  }

  const data = (await geminiRes.json()) as {
    candidates: Array<{
      content: {
        parts: Array<{ inlineData?: { data: string; mimeType: string } }>;
      };
    }>;
  };
  const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;

  if (!inlineData?.data) {
    throw new Error("No audio data in Gemini TTS response");
  }

  const ALLOWED_AUDIO_TYPES = ["audio/pcm"] as const;
  const responseMimeType = inlineData.mimeType ?? "audio/pcm";
  if (
    !ALLOWED_AUDIO_TYPES.includes(
      responseMimeType as (typeof ALLOWED_AUDIO_TYPES)[number],
    )
  ) {
    console.error("[tts] Unexpected mimeType from Gemini:", responseMimeType);
    throw new Error(`Unexpected audio mimeType: ${responseMimeType}`);
  }

  return json(
    { audio: inlineData.data, mimeType: "audio/pcm", sampleRate: 24000 },
    200,
    origin,
  );
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}
