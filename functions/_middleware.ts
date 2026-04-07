/**
 * Cloudflare Pages Middleware: Shared CORS utilities
 * Route: applies to all /api/* endpoints via onRequest export
 */
import type { Env, PagesContext } from './types.js';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://real-bee.pages.dev',
  '*.real-bee.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8788',
];

export function getAllowedOrigins(env: Env): string[] {
  if (!env.ALLOWED_ORIGINS) {
    return DEFAULT_ALLOWED_ORIGINS;
  }
  const configured = env.ALLOWED_ORIGINS
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured])];
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  return allowedOrigins.some((allowed) => {
    if (allowed === origin) return true;
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      return (origin.startsWith('https://') && origin.endsWith('.' + domain)) || origin === 'https://' + domain;
    }
    return false;
  });
}

export async function onRequestOptions(context: PagesContext): Promise<Response> {
  const origin = context.request.headers.get('origin') || '';
  const allowedOrigins = getAllowedOrigins(context.env);
  if (!isOriginAllowed(origin, allowedOrigins)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export const onRequest = async (context: PagesContext) => {
  try {
    return await context.next();
  } catch (err) {
    const origin = context.request.headers.get('origin') || '';
    const allowedOrigins = getAllowedOrigins(context.env);
    console.error('[middleware] Unhandled error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...(isOriginAllowed(origin, allowedOrigins) ? corsHeaders(origin) : {}),
      },
    });
  }
};
