import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequestPost } from '../gemini.js';
import type { Env, PagesContext } from '../../types.js';

const mockEnv: Env = {
  DB: {} as unknown as D1Database,
  GEMINI_API_KEY: 'test-key',
  ALLOWED_ORIGINS: 'http://localhost:5173',
};

function makeContext(body: unknown, origin = 'http://localhost:5173'): PagesContext {
  return {
    request: new Request('http://localhost/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin },
      body: JSON.stringify(body),
    }),
    env: mockEnv,
    next: vi.fn(),
    waitUntil: vi.fn(),
  } as unknown as PagesContext;
}

describe('POST /api/gemini', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 403 for disallowed origin', async () => {
    const res = await onRequestPost(makeContext({ action: 'tts', word: 'apple' }, 'https://evil.com'));
    expect(res.status).toBe(403);
  });

  it('returns 400 for missing action field', async () => {
    const res = await onRequestPost(makeContext({ word: 'apple' }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/action/i);
  });

  it('returns 400 for invalid action value', async () => {
    const res = await onRequestPost(makeContext({ action: 'unknown', word: 'apple' }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/action/i);
  });

  it('returns 400 for invalid JSON body', async () => {
    const context = {
      request: new Request('http://localhost/api/gemini', {
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

  it('dispatches action=tts to the TTS handler and returns PCM audio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ inlineData: { data: 'AAAA', mimeType: 'audio/pcm' } }] },
        }],
      }),
    }));

    const res = await onRequestPost(makeContext({ action: 'tts', word: 'apple' }));
    expect(res.status).toBe(200);
    const body = await res.json() as { audio: string; mimeType: string; sampleRate: number };
    expect(body.mimeType).toBe('audio/pcm');
    expect(body.sampleRate).toBe(24000);
    expect(body.audio).toBe('AAAA');

    vi.unstubAllGlobals();
  });

  it('dispatches action=hint to the hint handler (returns 503 without key)', async () => {
    const context = makeContext({ action: 'hint', word: 'apple', type: 'definition' });
    (context as unknown as { env: Env }).env = { ...mockEnv, GEMINI_API_KEY: '' };
    const res = await onRequestPost(context);
    expect(res.status).toBe(503);
  });

  it('dispatches action=stt to the STT handler (returns 503 without key)', async () => {
    const context = makeContext({
      action: 'stt',
      audio: btoa('fake-audio-data'),
      mimeType: 'audio/webm',
    });
    (context as unknown as { env: Env }).env = { ...mockEnv, GEMINI_API_KEY: '' };
    const res = await onRequestPost(context);
    expect(res.status).toBe(503);
  });

  it('strips action field before forwarding — tts handler sees { word } only', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: { parts: [{ inlineData: { data: 'AAAA', mimeType: 'audio/pcm' } }] },
          }],
        }),
      };
    }));

    await onRequestPost(makeContext({ action: 'tts', word: 'apple' }));
    // Ensure `action` was NOT forwarded to the Gemini API call
    expect(capturedBody).not.toBeNull();
    expect((capturedBody as Record<string, unknown>).action).toBeUndefined();

    vi.unstubAllGlobals();
  });
});
