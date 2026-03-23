/**
 * Tests for MSW Voice API Handlers (TTS/STT)
 * 
 * Verifies that mock handlers properly simulate real API behavior
 * for Text-to-Speech and Speech-to-Text endpoints.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../handlers';

type SttResponse = {
  results: {
    channels: Array<{
      alternatives: Array<{
        transcript: string;
        confidence: number;
      }>;
    }>;
  };
};

type ErrorResponse = { error: string };

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('MSW Voice Handlers', () => {
  describe('TTS Handler (POST /api/tts)', () => {
    it('returns binary audio data for valid text', async () => {
      const response = await fetch('http://localhost/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello world' }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
      expect(response.headers.get('Content-Length')).toBe('1024');

      const audioData = await response.arrayBuffer();
      expect(audioData).toBeInstanceOf(ArrayBuffer);
      expect(audioData.byteLength).toBe(1024);
    });

    it('returns 400 for missing text', async () => {
      const response = await fetch('http://localhost/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain('text');
    });

    it('returns 400 for invalid text type', async () => {
      const response = await fetch('http://localhost/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 123 }),
      });

      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid JSON', async () => {
      const response = await fetch('http://localhost/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('STT Handler (POST /api/stt)', () => {
    it('returns transcription for valid audio data', async () => {
      const audioBuffer = new ArrayBuffer(1024);
      const response = await fetch('http://localhost/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: audioBuffer,
      });

      expect(response.status).toBe(200);
      const data = await response.json() as SttResponse;
      expect(data.results.channels[0].alternatives[0]).toHaveProperty('transcript');
      expect(data.results.channels[0].alternatives[0]).toHaveProperty('confidence');
      expect(data.results.channels[0].alternatives[0].transcript).toBe('mock transcription');
      expect(data.results.channels[0].alternatives[0].confidence).toBe(0.95);
    });

    it('returns transcription for form data audio', async () => {
      const formData = new FormData();
      const audioBlob = new Blob([new ArrayBuffer(1024)], { type: 'audio/wav' });
      formData.append('audio', audioBlob, 'test.wav');

      const response = await fetch('http://localhost/api/stt', {
        method: 'POST',
        body: formData,
      });

      expect(response.status).toBe(200);
      const data = await response.json() as SttResponse;
      expect(data.results.channels[0].alternatives[0].transcript).toBe('mock transcription');
    });

    it('returns 400 for unsupported content type', async () => {
      const response = await fetch('http://localhost/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain('content type');
    });

    it('returns 400 for empty audio data', async () => {
      const response = await fetch('http://localhost/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: new ArrayBuffer(0),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain('empty');
    });

    it('returns 400 for form data without audio field', async () => {
      const formData = new FormData();
      formData.append('text', 'test'); // Wrong field

      const response = await fetch('http://localhost/api/stt', {
        method: 'POST',
        body: formData,
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain('No audio file');
    });
  });
});
