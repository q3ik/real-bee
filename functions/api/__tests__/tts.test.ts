import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from '../tts.js';
import type { Env, PagesContext } from '../../types.js';

const mockEnv: Env = {
  DB: {} as unknown as D1Database,
  GEMINI_API_KEY: 'test-key',
  ALLOWED_ORIGINS: 'http://localhost:5173',
};

function makeContext(body: unknown, origin = 'http://localhost:5173'): PagesContext {
  return {
    request: new Request('http://localhost/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin },
      body: JSON.stringify(body),
    }),
    env: mockEnv,
    next: vi.fn(),
    waitUntil: vi.fn(),
  } as unknown as PagesContext;
}

describe('POST /api/tts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 for missing word', async () => {
    const res = await onRequestPost(makeContext({}));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/word/i);
  });

  it('returns 400 for word exceeding 200 chars', async () => {
    const res = await onRequestPost(makeContext({ word: 'a'.repeat(201) }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/200/);
  });

  it('returns 400 for invalid voice', async () => {
    const res = await onRequestPost(makeContext({ word: 'apple', voice: 'unknown-voice' }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/voice/i);
  });

  it('returns 503 when GEMINI_API_KEY is missing', async () => {
    const context = makeContext({ word: 'apple' });
    (context as unknown as { env: Env }).env = { ...mockEnv, GEMINI_API_KEY: '' };
    const res = await onRequestPost(context);
    expect(res.status).toBe(503);
  });

  it('returns 403 for disallowed origin', async () => {
    const res = await onRequestPost(makeContext({ word: 'apple' }, 'https://evil.com'));
    expect(res.status).toBe(403);
  });

  it('returns { audio, mimeType } for valid input', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ inlineData: { data: 'AAAA', mimeType: 'audio/wav' } }] },
        }],
      }),
    }));

    const res = await onRequestPost(makeContext({ word: 'apple' }));
    expect(res.status).toBe(200);
    const body = await res.json() as { audio: string; mimeType: string };
    expect(body.audio).toBe('AAAA');
    expect(body.mimeType).toBe('audio/wav');

    vi.unstubAllGlobals();
  });

  it('returns 500 when Gemini API returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service unavailable',
    }));

    const res = await onRequestPost(makeContext({ word: 'apple' }));
    expect(res.status).toBe(500);

    vi.unstubAllGlobals();
  });

  it('returns 400 for word containing only whitespace', async () => {
    const res = await onRequestPost(makeContext({ word: '   ' }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/word/i);
  });

  it('returns 500 when Gemini response has no audio data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{}] } }],
      }),
    }));

    const res = await onRequestPost(makeContext({ word: 'apple' }));
    expect(res.status).toBe(500);

    vi.unstubAllGlobals();
  });

  it('returns 400 for invalid JSON body', async () => {
    const context = {
      request: new Request('http://localhost/api/tts', {
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
});
