/**
 * Cloudflare Pages Function: Speech-to-Text via Gemini, Cloudflare Whisper,
 * or Deepgram Nova-3
 *
 * Route: /api/stt
 * Method: POST
 *
 * Request body: { audio: string (base64), mimeType: string, provider?: string }
 * Response: { transcript: string }
 *
 * Provider selection precedence (most → least authoritative):
 *   1. env.STT_PROVIDER  — operator configuration, always wins
 *   2. request body 'provider' field — client hint, honoured only if env is unset
 *   3. 'gemini' — hard default
 *
 * env.STT_PROVIDER is validated against VALID_PROVIDERS at runtime.
 * An empty or unrecognised env value is treated as unset so the client
 * hint / default can apply as intended. A non-empty but invalid env value
 * returns 503 (misconfigured) immediately — it is never silently ignored.
 *
 * The client-supplied provider field is validated but cannot override the
 * operator's env setting. This prevents a client from forcing a more
 * expensive or restricted provider against operator intent.
 *
 * System prompt and generation config are hardcoded server-side.
 * The client cannot influence model selection or transcription behavior.
 */
import {
  getAllowedOrigins,
  corsHeaders,
  isOriginAllowed,
  onRequestOptions,
} from "../_middleware.js";
export { onRequestOptions };
import type { PagesContext } from "../types.js";

// MIME type matching is intentionally strict (no space-normalization).
// Browser MediaRecorder typically emits 'audio/webm;codecs=opus' (no space).
// RFC-valid variants with spaces (e.g. 'audio/webm; codecs=opus') are not accepted
// to keep validation simple and deterministic.
const ALLOWED_MIME_TYPES = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/mp4",
  "audio/wav",
  "audio/mpeg",
] as const;

type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Valid provider identifiers */
const VALID_PROVIDERS = ["gemini", "cloudflare-whisper", "deepgram"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

const STT_SYSTEM_PROMPT =
  "You are a spelling bee judge. The user has spoken a word. " +
  "Transcribe exactly the word you hear — return only the single word, lowercase, no punctuation, nothing else.";

/**
 * Safely decode a base64 string to a Uint8Array.
 *
 * `atob()` throws a `DOMException` (or `InvalidCharacterError`) for invalid
 * input. Wrapping it here means callers receive `null` for bad input rather
 * than having the error bubble up to the outer `catch` and become a 500.
 *
 * Client-supplied base64 that fails to decode is a 400 (bad request), not
 * a 500 (server error), so it must be distinguished from runtime failures.
 *
 * @returns Decoded bytes, or `null` if the string is not valid base64.
 */
function decodeBase64Audio(base64: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * Resolve and validate the STT provider from env + request body.
 *
 * Validation order:
 *  1. env.STT_PROVIDER (trimmed) — if set and valid, use it.
 *  2. env.STT_PROVIDER is set but invalid → return 503 immediately.
 *  3. requestedProvider (client hint) — already validated before this call.
 *  4. Fall back to 'gemini'.
 *
 * Returns either the resolved Provider string, or a Response (error).
 */
function resolveProvider(
  envValue: string | undefined,
  requestedProvider: unknown,
  origin: string,
): Provider | Response {
  const trimmedEnv = typeof envValue === "string" ? envValue.trim() : "";
  if (trimmedEnv) {
    if (VALID_PROVIDERS.includes(trimmedEnv as Provider)) {
      return trimmedEnv as Provider;
    }
    return json(
      {
        error: `Server misconfiguration: STT_PROVIDER "${trimmedEnv}" is not one of: ${VALID_PROVIDERS.join(", ")}`,
      },
      503,
      origin,
    );
  }

  if (
    requestedProvider !== undefined &&
    VALID_PROVIDERS.includes(requestedProvider as Provider)
  ) {
    return requestedProvider as Provider;
  }

  return "gemini";
}

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

  const { audio, mimeType, provider: requestedProvider } = body;

  if (!audio || typeof audio !== "string" || audio.trim().length === 0) {
    return json(
      { error: 'Missing or invalid "audio" field (expected base64 string)' },
      400,
      origin,
    );
  }
  const MAX_AUDIO_BASE64_LENGTH = 512 * 1024; // ~384 KB binary
  if ((audio as string).length > MAX_AUDIO_BASE64_LENGTH) {
    return json(
      { error: '"audio" exceeds maximum size (512 KB base64)' },
      400,
      origin,
    );
  }
  if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
    return json(
      {
        error: `Invalid "mimeType" — must be one of: ${ALLOWED_MIME_TYPES.join(", ")}`,
      },
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

  // Resolve and validate the provider (env > client hint > default).
  const providerOrError = resolveProvider(
    env.STT_PROVIDER,
    requestedProvider,
    origin,
  );
  if (providerOrError instanceof Response) return providerOrError;
  const selectedProvider = providerOrError;

  try {
    // Route to the selected provider
    if (selectedProvider === "cloudflare-whisper") {
      return await handleCloudflareWhisper(
        audio as string,
        mimeType as string,
        env,
        origin,
      );
    }

    if (selectedProvider === "deepgram") {
      return await handleDeepgram(
        audio as string,
        mimeType as string,
        env,
        origin,
      );
    }

    // Default: Gemini STT — guard only applies when no other provider is
    // configured. This allows Whisper/Deepgram to work independently of Gemini.
    if (!env.GEMINI_API_KEY) {
      return json({ error: "Gemini STT not configured" }, 503, origin);
    }

    return await handleGemini(audio as string, mimeType as string, env, origin);
  } catch (error) {
    console.error("[stt] Error:", error);
    return json({ error: "Transcription failed" }, 500, origin);
  }
}

/** Handle Cloudflare Whisper STT */
async function handleCloudflareWhisper(
  audio: string,
  mimeType: string,
  env: PagesContext["env"],
  origin: string,
): Promise<Response> {
  if (!env.AI) {
    return json({ error: "Cloudflare AI binding not configured" }, 503, origin);
  }

  // Decode base64 audio to Uint8Array for Cloudflare AI.
  // Use decodeBase64Audio() so invalid base64 yields 400 instead of
  // falling through to the outer catch (which would return 500).
  const audioBytes = decodeBase64Audio(audio);
  if (audioBytes === null) {
    return json({ error: "Invalid base64 audio encoding" }, 400, origin);
  }

  const result = (await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
    audio: audioBytes as unknown as string,
  })) as { text?: string };

  const transcript = result.text?.trim() ?? "";

  if (!transcript) {
    throw new Error("Empty transcript from Cloudflare Whisper");
  }

  return json({ transcript }, 200, origin);
}

/** Handle Deepgram Nova-3 STT */
async function handleDeepgram(
  audio: string,
  mimeType: string,
  env: PagesContext["env"],
  origin: string,
): Promise<Response> {
  if (!env.DEEPGRAM_API_KEY) {
    return json({ error: "Deepgram STT not configured" }, 503, origin);
  }

  // Decode base64 audio to Uint8Array for Deepgram.
  // Use decodeBase64Audio() so invalid base64 yields 400 instead of
  // falling through to the outer catch (which would return 500).
  const audioBuffer = decodeBase64Audio(audio);
  if (audioBuffer === null) {
    return json({ error: "Invalid base64 audio encoding" }, 400, origin);
  }

  const url = new URL("https://api.deepgram.com/v1/listen");
  url.searchParams.set("model", "nova-3");
  url.searchParams.set("language", "en");

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
      "Content-Type": mimeType,
    },
    body: audioBuffer,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("[stt] Deepgram API error:", res.status, errorBody);
    throw new Error(`Deepgram STT error: ${res.status}`);
  }

  const data = (await res.json()) as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{ transcript?: string }>;
      }>;
    };
  };

  const transcript =
    data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";

  if (!transcript) {
    throw new Error("Empty transcript from Deepgram");
  }

  return json({ transcript }, 200, origin);
}

/** Handle Gemini STT */
async function handleGemini(
  audio: string,
  mimeType: string,
  env: PagesContext["env"],
  origin: string,
): Promise<Response> {
  const geminiRes = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: STT_SYSTEM_PROMPT }] },
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType as string,
                  data: audio as string,
                },
              },
              { text: "What word was spoken?" },
            ],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 20 },
      }),
    },
  );

  if (!geminiRes.ok) {
    const errorBody = await geminiRes.text();
    console.error("[stt] Gemini API error:", geminiRes.status, errorBody);
    throw new Error(`Gemini STT error: ${geminiRes.status}`);
  }

  const data = (await geminiRes.json()) as {
    candidates: Array<{ content: { parts: Array<{ text?: string }> } }>;
  };
  const transcript =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

  if (!transcript) {
    throw new Error("Empty transcript from Gemini");
  }

  return json({ transcript }, 200, origin);
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}
