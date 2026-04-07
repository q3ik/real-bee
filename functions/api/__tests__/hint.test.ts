import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from '../hint.js';
import type { Env, PagesContext } from '../../types.js';

const mockEnv: Env = {
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({ run: vi.fn().mockResolvedValue({}) }),
    }),
  } as unknown as D1Database,
  GEMINI_API_KEY: 'test-gemini-key',
  ALLOWED_ORIGINS: 'http://localhost:5173',
};

function makeContext(body: unknown, origin = 'http://localhost:5173'): PagesContext {
  return {
    request: new Request('http://localhost/api/hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin },
      body: JSON.stringify(body),
    }),
    env: mockEnv,
    next: vi.fn(),
    waitUntil: vi.fn(),
  } as unknown as PagesContext;
}

describe('POST /api/hint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for missing word', async () => {
    const res = await onRequestPost(makeContext({ type: 'definition' }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/word/i);
  });

  it('returns 400 for empty word', async () => {
    const res = await onRequestPost(makeContext({ word: '  ', type: 'definition' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid type', async () => {
    const res = await onRequestPost(makeContext({ word: 'apple', type: 'phonetic' }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/type/i);
  });

  it('returns 400 for invalid JSON', async () => {
    const context = {
      request: new Request('http://localhost/api/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'http://localhost:5173' },
        body: 'not-json',
      }),
      env: mockEnv,
      next: vi.fn(),
      waitUntil: vi.fn(),
    } as unknown as PagesContext;
    const res = await onRequestPost(context);
    expect(res.status).toBe(400);
  });

  it('returns 403 for disallowed origin', async () => {
    const res = await onRequestPost(makeContext({ word: 'apple', type: 'definition' }, 'https://evil.com'));
    expect(res.status).toBe(403);
  });

  it('returns 503 when GEMINI_API_KEY is missing', async () => {
    const envNoKey = { ...mockEnv, GEMINI_API_KEY: '' };
    const context = makeContext({ word: 'apple', type: 'definition' });
    (context as unknown as { env: Env }).env = envNoKey;
    const res = await onRequestPost(context);
    expect(res.status).toBe(503);
  });

  it('returns { hint: string } for valid input', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'A round red fruit.' }] } }],
      }),
    }));

    const res = await onRequestPost(makeContext({ word: 'apple', type: 'definition' }));
    expect(res.status).toBe(200);
    const body = await res.json() as { hint: string };
    expect(typeof body.hint).toBe('string');
    expect(body.hint.length).toBeGreaterThan(0);
    expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO hint_events')
    );

    vi.unstubAllGlobals();
  });

  it('returns 500 when Gemini API returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service unavailable',
    }));

    const res = await onRequestPost(makeContext({ word: 'apple', type: 'definition' }));
    expect(res.status).toBe(500);

    vi.unstubAllGlobals();
  });
});
