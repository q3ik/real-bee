/**
 * Audio Mocking Infrastructure for E2E Tests
 * 
 * Provides comprehensive mocking for:
 * - speechSynthesis API (Text-to-Speech)
 * - AudioContext (Web Audio API)
 * - Speech tracking and verification utilities
 * 
 * Usage:
 *   import { mockSpeechSynthesis, waitForSpeech } from './helpers/audio-mocks';
 *   
 *   test.beforeEach(async ({ page }) => {
 *     await mockSpeechSynthesis(page);
 *   });
 *   
 *   test('speech test', async ({ page }) => {
 *     await waitForSpeech(page, 'expected text');
 *   });
 */

import type { Page } from '@playwright/test';

interface SpeechHistoryEntry {
  text: string;
  timestamp: number;
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
}

interface MockSpeechOptions {
  speakDelay?: number;
  speakDuration?: number;
  simulateErrors?: boolean;
}

interface TTSStatus {
  hasSynthesis: boolean;
  hasUtterance: boolean;
  hasTracking: boolean;
  canGetVoices: boolean;
  voiceCount: number;
  voices: Array<{ name: string; lang: string }>;
}

/**
 * Mock speechSynthesis API for E2E tests
 * Captures spoken text and simulates TTS lifecycle events
 * 
 * @param page - Playwright page object
 * @param options - Configuration options
 * @param options.speakDelay - Delay before firing onstart event (ms)
 * @param options.speakDuration - Duration of speech simulation (ms)
 * @param options.simulateErrors - Whether to simulate random errors
 */
export const mockSpeechSynthesis = async (page: Page, options: MockSpeechOptions = {}): Promise<void> => {
  const {
    speakDelay = 50,
    speakDuration = 100,
    simulateErrors = false,
  } = options;

  await page.addInitScript(
    ({ speakDelay, speakDuration, simulateErrors }) => {
      // Store original if exists
      window.__originalSpeechSynthesis = window.speechSynthesis;

      // Track spoken utterances with timestamps
      window.__spokenUtterances = [];
      window.__speechHistory = [];

      // Mock SpeechSynthesisUtterance
      class MockSpeechSynthesisUtterance {
        text: string;
        lang: string;
        voice: null;
        volume: number;
        rate: number;
        pitch: number;
        onstart: ((event: { type: string; utterance: MockSpeechSynthesisUtterance }) => void) | null;
        onend: ((event: { type: string; utterance: MockSpeechSynthesisUtterance }) => void) | null;
        onerror: ((event: { type: string; utterance: MockSpeechSynthesisUtterance; error: string }) => void) | null;
        onpause: ((event: { type: string; utterance: MockSpeechSynthesisUtterance }) => void) | null;
        onresume: ((event: { type: string; utterance: MockSpeechSynthesisUtterance }) => void) | null;
        onboundary: null;
        onmark: null;

        constructor(text: string) {
          this.text = text;
          this.lang = 'en-US';
          this.voice = null;
          this.volume = 1;
          this.rate = 1;
          this.pitch = 1;
          this.onstart = null;
          this.onend = null;
          this.onerror = null;
          this.onpause = null;
          this.onresume = null;
          this.onboundary = null;
          this.onmark = null;
        }
      }

      // Mock speechSynthesis
      const mockSynthesis = {
        speaking: false,
        pending: false,
        paused: false,
        _currentUtterance: null as MockSpeechSynthesisUtterance | null,
        _queue: [] as MockSpeechSynthesisUtterance[],

        speak(utterance: MockSpeechSynthesisUtterance) {
          console.log('[Mock TTS] Speaking:', utterance.text);
          
          // Store for verification
          window.__spokenUtterances.push(utterance.text);
          window.__speechHistory.push({
            text: utterance.text,
            timestamp: Date.now(),
            lang: utterance.lang,
            rate: utterance.rate,
            pitch: utterance.pitch,
            volume: utterance.volume,
          });
          
          // Also store in __lastSpokenText for backward compatibility
          window.__lastSpokenText = utterance.text;

          this._queue.push(utterance);
          
          if (!this.speaking) {
            this._processQueue();
          }
        },

        _processQueue() {
          if (this._queue.length === 0) {
            this.speaking = false;
            this.pending = false;
            return;
          }

          const utterance = this._queue.shift();
          if (!utterance) return;
          this._currentUtterance = utterance;
          this.speaking = true;
          this.pending = this._queue.length > 0;

          // Simulate speech start
          setTimeout(() => {
            if (utterance.onstart) {
              utterance.onstart({ type: 'start', utterance });
            }
          }, speakDelay);

          // Simulate speech end or error
          setTimeout(() => {
            this.speaking = false;
            this._currentUtterance = null;

            // Simulate random errors if enabled
            if (simulateErrors && Math.random() < 0.1) {
              if (utterance.onerror) {
                utterance.onerror({ 
                  type: 'error', 
                  utterance,
                  error: 'synthesis-unavailable' 
                });
              }
            } else {
              if (utterance.onend) {
                utterance.onend({ type: 'end', utterance });
              }
            }

            // Process next in queue
            this._processQueue();
          }, speakDelay + speakDuration);
        },

        cancel() {
          console.log('[Mock TTS] Cancel');
          this._queue = [];
          this.speaking = false;
          this.pending = false;
          
          if (this._currentUtterance && this._currentUtterance.onend) {
            this._currentUtterance.onend({ 
              type: 'end', 
              utterance: this._currentUtterance 
            });
          }
          this._currentUtterance = null;
        },

        pause() {
          console.log('[Mock TTS] Pause');
          this.paused = true;
          if (this._currentUtterance && this._currentUtterance.onpause) {
            this._currentUtterance.onpause({ 
              type: 'pause', 
              utterance: this._currentUtterance 
            });
          }
        },

        resume() {
          console.log('[Mock TTS] Resume');
          this.paused = false;
          if (this._currentUtterance && this._currentUtterance.onresume) {
            this._currentUtterance.onresume({ 
              type: 'resume', 
              utterance: this._currentUtterance 
            });
          }
        },

        getVoices() {
          return [
            {
              name: 'Mock Voice - English (US)',
              lang: 'en-US',
              default: true,
              localService: true,
              voiceURI: 'mock-voice-en-US',
            },
            {
              name: 'Mock Voice - English (UK)',
              lang: 'en-GB',
              default: false,
              localService: true,
              voiceURI: 'mock-voice-en-GB',
            },
          ];
        },

        _voicesChangedListeners: [] as Array<() => void>,

        addEventListener(event: string, handler: () => void): void {
          console.log('[Mock TTS] addEventListener:', event);
          // Store listeners for voiceschanged event
          if (event === 'voiceschanged') {
            this._voicesChangedListeners.push(handler);
            // Fire immediately since voices are available
            setTimeout(() => handler(), 0);
          }
        },

        removeEventListener(event: string, handler: () => void): void {
          console.log('[Mock TTS] removeEventListener:', event);
          if (event === 'voiceschanged') {
            this._voicesChangedListeners = this._voicesChangedListeners.filter(
              (h) => h !== handler
            );
          }
        },
      };

      // Replace global speechSynthesis
      Object.defineProperty(window, 'speechSynthesis', {
        value: mockSynthesis,
        writable: false,
        configurable: true,
      });

      // Replace SpeechSynthesisUtterance
      window.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

      console.log('[Mock TTS] Initialized');
    },
    { speakDelay, speakDuration, simulateErrors }
  );
};

/**
 * Mock AudioContext for Web Audio API
 * 
 * @param page - Playwright page object
 */
export const mockAudioContext = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    class MockAudioContext {
      state: string;
      sampleRate: number;
      destination: { channelCount: number; maxChannelCount: number; numberOfInputs: number; numberOfOutputs: number };
      _startTime: number;

      constructor() {
        this.state = 'running';
        // currentTime is managed via getter; do not assign here
        this.sampleRate = 44100;
        this.destination = {
          channelCount: 2,
          maxChannelCount: 2,
          numberOfInputs: 1,
          numberOfOutputs: 0,
        };
        this._startTime = Date.now();
      }

      get currentTime(): number {
        return (Date.now() - this._startTime) / 1000;
      }

      createOscillator() {
        return {
          type: 'sine',
          frequency: { value: 440 },
          detune: { value: 0 },
          connect: () => {},
          disconnect: () => {},
          start: () => {},
          stop: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
        };
      }

      createGain() {
        return {
          gain: { value: 1 },
          connect: () => {},
          disconnect: () => {},
        };
      }

      createBufferSource() {
        return {
          buffer: null,
          playbackRate: { value: 1 },
          loop: false,
          loopStart: 0,
          loopEnd: 0,
          connect: () => {},
          disconnect: () => {},
          start: () => {},
          stop: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
        };
      }

      createAnalyser() {
        return {
          fftSize: 2048,
          frequencyBinCount: 1024,
          minDecibels: -100,
          maxDecibels: -30,
          smoothingTimeConstant: 0.8,
          connect: () => {},
          disconnect: () => {},
          getByteFrequencyData: () => {},
          getByteTimeDomainData: () => {},
          getFloatFrequencyData: () => {},
          getFloatTimeDomainData: () => {},
        };
      }

      createBiquadFilter() {
        return {
          type: 'lowpass',
          frequency: { value: 350 },
          Q: { value: 1 },
          gain: { value: 0 },
          connect: () => {},
          disconnect: () => {},
        };
      }

      createDynamicsCompressor() {
        return {
          threshold: { value: -24 },
          knee: { value: 30 },
          ratio: { value: 12 },
          attack: { value: 0.003 },
          release: { value: 0.25 },
          connect: () => {},
          disconnect: () => {},
        };
      }

      createMediaStreamSource(stream: MediaStream) {
        return {
          mediaStream: stream,
          connect: () => {},
          disconnect: () => {},
        };
      }

      decodeAudioData(arrayBuffer: ArrayBuffer) {
        // Return mock audio buffer
        return Promise.resolve({
          sampleRate: 44100,
          length: 44100,
          duration: 1,
          numberOfChannels: 2,
          getChannelData: () => new Float32Array(44100),
        });
      }

      resume() {
        this.state = 'running';
        return Promise.resolve();
      }

      suspend() {
        this.state = 'suspended';
        return Promise.resolve();
      }

      close() {
        this.state = 'closed';
        return Promise.resolve();
      }
    }

    // Cast required: MockAudioContext is a minimal mock, not a full AudioContext implementation
    window.AudioContext = MockAudioContext as unknown as typeof AudioContext;
    window.webkitAudioContext = MockAudioContext as unknown as typeof AudioContext;

    console.log('[Mock AudioContext] Initialized');
  });
};

/**
 * Get all spoken text from the page
 * 
 * @param page - Playwright page object
 */
export const getSpokenText = async (page: Page): Promise<string[]> => {
  return await page.evaluate(() => window.__spokenUtterances || []);
};

/**
 * Get detailed speech history with metadata
 * 
 * @param page - Playwright page object
 */
export const getSpeechHistory = async (page: Page): Promise<SpeechHistoryEntry[]> => {
  return await page.evaluate(() => window.__speechHistory || []);
};

/**
 * Get the last spoken text (for backward compatibility)
 * 
 * @param page - Playwright page object
 */
export const getLastSpokenText = async (page: Page): Promise<string> => {
  return await page.evaluate(() => window.__lastSpokenText || '');
};

/**
 * Wait for specific text to be spoken
 * 
 * @param page - Playwright page object
 * @param expectedText - Text to wait for (case-insensitive substring match)
 * @param timeout - Maximum wait time in milliseconds
 * @throws {Error} If timeout is reached
 */
export const waitForSpeech = async (page: Page, expectedText: string, timeout = 5000): Promise<boolean> => {
  const startTime = Date.now();
  const normalizedExpected = expectedText.toLowerCase();

  while (Date.now() - startTime < timeout) {
    const spoken = await getSpokenText(page);

    if (
      spoken.some((text) => text.toLowerCase().includes(normalizedExpected))
    ) {
      return true;
    }

    await page.waitForTimeout(100);
  }

  const allSpoken = await getSpokenText(page);
  throw new Error(
    `Expected text "${expectedText}" not spoken within ${timeout}ms.\n` +
      `Spoken text: ${JSON.stringify(allSpoken)}`
  );
};

/**
 * Wait for any speech to occur
 * 
 * @param page - Playwright page object
 * @param timeout - Maximum wait time in milliseconds
 * @throws {Error} If timeout is reached
 */
export const waitForAnySpeech = async (page: Page, timeout = 5000): Promise<boolean> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const spoken = await getSpokenText(page);

    if (spoken.length > 0) {
      return true;
    }

    await page.waitForTimeout(100);
  }

  throw new Error(`No speech detected within ${timeout}ms`);
};

/**
 * Clear spoken text history
 * 
 * @param page - Playwright page object
 */
export const clearSpokenText = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    window.__spokenUtterances = [];
    window.__speechHistory = [];
    window.__lastSpokenText = '';
  });
};

/**
 * Verify TTS mock is working correctly
 * 
 * @param page - Playwright page object
 */
export const verifyTTSWorking = async (page: Page): Promise<TTSStatus> => {
  return await page.evaluate((): TTSStatus => {
    const hasSynthesis = 'speechSynthesis' in window;
    const hasUtterance = typeof window.SpeechSynthesisUtterance === 'function';
    const hasTracking = Array.isArray(window.__spokenUtterances);

    let voices: SpeechSynthesisVoice[] = [];
    let canGetVoices = false;

    if (hasSynthesis) {
      try {
        voices = window.speechSynthesis.getVoices();
        canGetVoices = true;
      } catch (error) {
        console.error('[TTS Verify] Error getting voices:', error);
      }
    }

    return {
      hasSynthesis,
      hasUtterance,
      hasTracking,
      canGetVoices,
      voiceCount: voices.length,
      voices: voices.map((v) => ({ name: v.name, lang: v.lang })),
    };
  });
};

/**
 * Test speech by speaking and verifying capture
 * 
 * @param page - Playwright page object
 * @param text - Text to speak
 */
export const testSpeech = async (page: Page, text: string): Promise<boolean> => {
  await clearSpokenText(page);

  await page.evaluate((text) => {
    const utterance = new window.SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  }, text);

  try {
    await waitForSpeech(page, text, 2000);
    return true;
  } catch (error) {
    console.error('[Test Speech] Failed:', (error as Error).message);
    return false;
  }
};

/**
 * Extract spoken word from various TTS message formats
 * Handles multiple pattern variations across different TTS engines
 * 
 * @param spokenMessage - The captured spoken text
 * @returns The extracted word
 * @throws {Error} If unable to extract word
 */
export const extractSpokenWord = (spokenMessage: string): string => {
  if (!spokenMessage) {
    throw new Error('No spoken text provided');
  }

  // Try multiple regex patterns to handle different TTS output formats
  const patterns = [
    /Your word is[:\s]+([a-zA-Z]+)/i, // "Your word is: example" or "Your word is example"
    /Spell the word[:\s]+([a-zA-Z]+)/i, // "Spell the word: example"
    /The word is[:\s]+([a-zA-Z]+)/i, // "The word is: example"
    /word[:\s]+([a-zA-Z]+)/i, // Generic "word: example"
    /^([a-zA-Z]+)$/, // Just the word itself
  ];

  for (const pattern of patterns) {
    const match = spokenMessage.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Fallback: try to extract any standalone word from the message
  const words = spokenMessage.match(/\b[a-zA-Z]{3,}\b/g);
  if (words && words.length > 0) {
    // Return the last substantial word (likely the target word)
    return words[words.length - 1].trim();
  }

  throw new Error(
    `Unable to extract spoken word from message: "${spokenMessage}"`
  );
};
