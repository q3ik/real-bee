/**
 * Shared type definitions for Cloudflare Pages Functions
 */

/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare environment bindings (from wrangler.toml)
 */
export interface Env {
  DB: D1Database;
  GEMINI_API_KEY: string;
  ALLOWED_ORIGINS?: string;
}

export type PagesContext = EventContext<Env, string, Record<string, unknown>>;
