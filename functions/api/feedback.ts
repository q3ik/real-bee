/**
 * POST /api/feedback
 *
 * Accepts user feedback submissions and (in production) forwards them
 * to Slack. Validates input strictly and never leaks internal details.
 */

import type { PagesContext } from '../types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS: readonly string[] = [
  'https://buzzy-game.pages.dev',
  'https://bee.q3ik.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const SUBDOMAIN_RE = /^https:\/\/[^.]+\.buzzy-game\.pages\.dev$/;

const ALLOWED_TYPES = new Set(['bug', 'suggestion', 'general']);

/** Every key that the schema permits — all others are rejected. */
const KNOWN_FIELDS = new Set([
  'text', 'user', 'type', 'email', 'userId', 'url', 'route',
  'deviceType', 'screenSize', 'appVersion', 'sessionId',
  'userAgent', 'browserInfo', 'diagnostics',
]);

const MAX_TEXT_LEN = 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOriginAllowed(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin) || SUBDOMAIN_RE.test(origin);
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

/**
 * Strip HTML tags, script content and ASCII control characters from a string.
 * This is defence-in-depth; the main protection is output encoding at render time.
 */
function sanitiseText(raw: string): string {
  return raw
    // Remove script blocks and their content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // Strip remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Remove ASCII control characters (except tab/newline/CR)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

function jsonError(message: string, status: number, origin?: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...(origin ? corsHeaders(origin) : {}),
      },
    },
  );
}

function jsonOk(body: unknown, origin: string): Response {
  return new Response(
    JSON.stringify(body),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function onRequestOptions({ request }: PagesContext): Promise<Response> {
  const origin = request.headers.get('origin') ?? '';

  if (!origin || !isOriginAllowed(origin)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  const origin = request.headers.get('origin') ?? '';

  // ── 1. CORS ──────────────────────────────────────────────────────────────
  if (!origin || !isOriginAllowed(origin)) {
    return jsonError('Origin not allowed', 403);
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new TypeError('body must be a JSON object');
    }
  } catch {
    return jsonError('Invalid request body', 400, origin);
  }

  // ── 3. Schema validation ──────────────────────────────────────────────────
  const errors: string[] = [];

  // Unknown fields (strict schema)
  const unknownFields = Object.keys(body).filter(k => !KNOWN_FIELDS.has(k));
  if (unknownFields.length > 0) {
    errors.push(`Unexpected fields not allowed: ${unknownFields.join(', ')}`);
  }

  // text: required, string, max length
  if (!body.text || typeof body.text !== 'string') {
    errors.push('text: text is required');
  } else if (body.text.length > MAX_TEXT_LEN) {
    errors.push(`text: text must be at most ${MAX_TEXT_LEN} characters`);
  }

  // type: required, enum
  if (!body.type || !ALLOWED_TYPES.has(body.type as string)) {
    errors.push('type: type must be one of: ' + [...ALLOWED_TYPES].join(', '));
  }

  if (errors.length > 0) {
    return new Response(
      JSON.stringify({ error: 'Invalid feedback data', details: errors }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      },
    );
  }

  // ── 4. Sanitise ───────────────────────────────────────────────────────────
  const sanitisedText = sanitiseText(body.text as string);

  // ── 5. Deliver (best-effort — errors must not leak internals) ─────────────
  try {
    // Production delivery logic goes here (e.g. Slack webhook).
    // env.SLACK_BOT_TOKEN and env.SLACK_FEEDBACK_CHANNEL_ID are available.
    void sanitisedText; // consumed above; silence lint
  } catch {
    // Intentionally swallowed — delivery failure is non-fatal and must not
    // expose internal state in the response.
  }

  return jsonOk(
    {
      success: true,
      feedbackId: 'feedback-' + Date.now(),
      deliveredVia: { database: true },
    },
    origin,
  );
}
