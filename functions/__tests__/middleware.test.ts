import { describe, it, expect } from 'vitest';
import {
  corsHeaders,
  getAllowedOrigins,
  isOriginAllowed,
} from '../_middleware.js';
import type { Env } from '../types.js';

const baseEnv = { DB: {} as Env['DB'], GEMINI_API_KEY: 'test-key' } as Env;

describe('corsHeaders', () => {
  it('returns expected CORS headers for a given origin', () => {
    const headers = corsHeaders('http://localhost:5173');
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    expect(headers['Access-Control-Allow-Methods']).toContain('POST');
  });
});

describe('getAllowedOrigins', () => {
  it('returns default origins when ALLOWED_ORIGINS not set', () => {
    const origins = getAllowedOrigins(baseEnv);
    expect(origins).toContain('http://localhost:5173');
  });

  it('merges env origins with defaults', () => {
    const env = { ...baseEnv, ALLOWED_ORIGINS: 'https://custom.example.com' };
    const origins = getAllowedOrigins(env);
    expect(origins).toContain('https://custom.example.com');
    expect(origins).toContain('http://localhost:5173');
  });
});

describe('isOriginAllowed', () => {
  it('allows exact match origin', () => {
    expect(isOriginAllowed('http://localhost:5173', ['http://localhost:5173'])).toBe(true);
  });

  it('rejects unknown origin', () => {
    expect(isOriginAllowed('https://evil.com', ['http://localhost:5173'])).toBe(false);
  });

  it('allows wildcard subdomain', () => {
    expect(isOriginAllowed('https://sub.real-bee.pages.dev', ['*.real-bee.pages.dev'])).toBe(true);
  });

  it('rejects empty origin', () => {
    expect(isOriginAllowed('', ['http://localhost:5173'])).toBe(false);
  });

  it('allows base domain when wildcard pattern is set', () => {
    expect(isOriginAllowed('https://real-bee.pages.dev', ['*.real-bee.pages.dev'])).toBe(true);
  });
});
