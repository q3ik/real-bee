/**
 * Unit tests for ACTION_SCHEMAS in functions/api/gemini.ts.
 *
 * These run in Node/Vitest — no Cloudflare Workers runtime needed.
 * We import the schemas directly; the Cloudflare-specific handler
 * exports (onRequestPost) are NOT called here.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Import schemas directly — gemini.ts re-exports ACTION_SCHEMAS for testability.
import { ACTION_SCHEMAS } from '../../functions/api/gemini';

// ---------------------------------------------------------------------------
// TTS schema
// ---------------------------------------------------------------------------
describe('ACTION_SCHEMAS.tts', () => {
  const schema = ACTION_SCHEMAS.tts as z.ZodObject<z.ZodRawShape>;

  it('accepts a minimal valid payload', () => {
    const result = schema.safeParse({ word: 'caterpillar' });
    expect(result.success).toBe(true);
  });

  it('accepts optional voice and provider fields', () => {
    const result = schema.safeParse({
      word: 'butterfly',
      voice: 'en-US-Standard-A',
      provider: 'elevenlabs',
    });
    expect(result.success).toBe(true);
  });

  it('strips unknown fields', () => {
    const result = schema.safeParse({ word: 'bee', injected: 'evil' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).injected).toBeUndefined();
    }
  });

  it('rejects missing word', () => {
    const result = schema.safeParse({ voice: 'en-US' });
    expect(result.success).toBe(false);
  });

  it('rejects empty word string', () => {
    const result = schema.safeParse({ word: '' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// STT schema
// ---------------------------------------------------------------------------
describe('ACTION_SCHEMAS.stt', () => {
  const schema = ACTION_SCHEMAS.stt as z.ZodObject<z.ZodRawShape>;

  it('accepts a valid payload', () => {
    const result = schema.safeParse({
      audio: 'dGVzdA==',  // base64 "test"
      mimeType: 'audio/webm',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional provider field', () => {
    const result = schema.safeParse({
      audio: 'dGVzdA==',
      mimeType: 'audio/webm',
      provider: 'deepgram',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing audio', () => {
    const result = schema.safeParse({ mimeType: 'audio/webm' });
    expect(result.success).toBe(false);
  });

  it('rejects empty audio string', () => {
    const result = schema.safeParse({ audio: '', mimeType: 'audio/webm' });
    expect(result.success).toBe(false);
  });

  it('rejects missing mimeType', () => {
    const result = schema.safeParse({ audio: 'dGVzdA==' });
    expect(result.success).toBe(false);
  });

  it('rejects empty mimeType string', () => {
    const result = schema.safeParse({ audio: 'dGVzdA==', mimeType: '' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Hint schema
// ---------------------------------------------------------------------------
describe('ACTION_SCHEMAS.hint', () => {
  const schema = ACTION_SCHEMAS.hint as z.ZodObject<z.ZodRawShape>;

  it('accepts a valid payload', () => {
    const result = schema.safeParse({ word: 'metamorphosis', type: 'definition' });
    expect(result.success).toBe(true);
  });

  it('rejects missing word', () => {
    const result = schema.safeParse({ type: 'definition' });
    expect(result.success).toBe(false);
  });

  it('rejects missing type', () => {
    const result = schema.safeParse({ word: 'metamorphosis' });
    expect(result.success).toBe(false);
  });

  it('rejects empty word string', () => {
    const result = schema.safeParse({ word: '', type: 'sentence' });
    expect(result.success).toBe(false);
  });

  it('rejects empty type string', () => {
    const result = schema.safeParse({ word: 'metamorphosis', type: '' });
    expect(result.success).toBe(false);
  });
});
