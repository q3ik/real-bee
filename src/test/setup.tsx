// Polyfill TransformStream for MSW v2.x compatibility
// Using any cast to avoid Node.js type requirements in test environment
const NodeTransformStream = (globalThis as any).TransformStream || class {};
const TextEncoder =
  (globalThis as any).TextEncoder ||
  class {
    encode() {
      return new Uint8Array(0);
    }
  };
const TextDecoder =
  (globalThis as any).TextDecoder ||
  class {
    decode() {
      return "";
    }
  };
import React from "react";

let polyfillApplied = false;
if (!globalThis.TransformStream) {
  globalThis.TransformStream = NodeTransformStream;
  polyfillApplied = true;
}
if (typeof window !== "undefined" && !window.TransformStream) {
  window.TransformStream = NodeTransformStream;
}
if (typeof global !== "undefined" && !global.TransformStream) {
  global.TransformStream = NodeTransformStream;
}
if (!globalThis.TextEncoder) {
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

// Import fake-indexeddb before other test setup
import "fake-indexeddb/auto";
import { indexedDB, IDBKeyRange, IDBTransaction } from "fake-indexeddb";

// Explicitly set IndexedDB globals to ensure they're available
globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;
globalThis.IDBTransaction = IDBTransaction;

// Import browser API mocks EARLY before any other imports
import {
  setupBrowserMocks,
  cleanupBrowserMocks,
} from "../../tests/setup/browser-mocks.js";

// Initialize browser mocks immediately
setupBrowserMocks();

import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, afterAll, vi } from "vitest";

// Import and setup MSW server for network mocking
import { server, resetServerHandlers } from "../../tests/mocks/server.js";

// Start MSW server before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: "warn",
  });
});

// Cleanup after each test to avoid state leakage across suites
afterEach(() => {
  cleanup();
  cleanupBrowserMocks();
  resetServerHandlers();
  vi.restoreAllMocks();
  // vi.restoreAllMocks() only restores vi.spyOn spies; manually-assigned vi.fn()
  // instances must be cleared explicitly so call history doesn't leak between tests.
  vi.mocked(window.scrollTo).mockClear();
});

// Close MSW server and cleanup polyfills after all tests complete
afterAll(() => {
  server.close();

  if (polyfillApplied) {
    (globalThis as any).TransformStream = undefined;
  }
});

// DOM API Polyfills
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Mock window.scrollTo — jsdom does not implement this and logs a noisy
// "Not implemented" error.  A no-op stub is sufficient for tests.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock Web Speech API - SpeechSynthesis
const mockSpeechSynthesis = {
  speak: vi.fn((utterance) => {
    setTimeout(() => {
      if (utterance.onstart) utterance.onstart();
      setTimeout(() => {
        if (utterance.onend) utterance.onend();
      }, 100);
    }, 50);
  }),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn(() => [
    {
      name: "Test Voice",
      lang: "en-US",
      default: true,
      localService: true,
    },
  ]),
  speaking: false,
  pending: false,
  paused: false,
  onvoiceschanged: null,
};
Object.defineProperty(window, "speechSynthesis", {
  value: mockSpeechSynthesis,
  writable: true,
  configurable: true,
});

// Mock Web Speech API - SpeechSynthesis
interface MockUtterance {
  text: string;
  lang: string;
  voice: unknown;
  volume: number;
  rate: number;
  pitch: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  onpause: (() => void) | null;
  onresume: (() => void) | null;
  onmark: ((event: unknown) => void) | null;
  onboundary: ((event: unknown) => void) | null;
}

class MockSpeechSynthesisUtterance {
  text: string;
  lang: string;
  voice: unknown;
  volume: number;
  rate: number;
  pitch: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  onpause: (() => void) | null;
  onresume: (() => void) | null;
  onmark: ((event: unknown) => void) | null;
  onboundary: ((event: unknown) => void) | null;

  constructor(text = "") {
    this.text = text;
    this.lang = "en-US";
    this.voice = null;
    this.volume = 1;
    this.rate = 1;
    this.pitch = 1;
    this.onstart = null;
    this.onend = null;
    this.onerror = null;
    this.onpause = null;
    this.onresume = null;
    this.onmark = null;
    this.onboundary = null;
  }
}
(globalThis as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

// Mock audioSessionManager
vi.mock("@/lib/audioSessionManager", () => ({
  audioSessionManager: {
    initialize: vi.fn(() => Promise.resolve({ success: true })),
    ensureActive: vi.fn(() => Promise.resolve({ success: true })),
    cleanup: vi.fn(() => Promise.resolve({ success: true })),
    getRoutingState: vi.fn(() => "unknown"),
    getContext: vi.fn(() => null),
    getInitialized: vi.fn(() => true),
  },
}));

// Mock SoundManager
vi.mock("@/game-engine/SoundManager", () => ({
  soundManager: {
    getContext: vi.fn(() => null),
    play: vi.fn(),
    playAudioBuffer: vi.fn(() => Promise.resolve()),
    preloadAudio: vi.fn(() => Promise.resolve()),
    isCached: vi.fn(() => false),
    getCacheStats: vi.fn(() => ({ size: 0, maxSize: 50, keys: [] })),
    clearCache: vi.fn(),
    stopAll: vi.fn(),
    cleanup: vi.fn(),
    isSupported: true,
  },
  SOUND_FREQUENCIES: {
    correct: [523.25, 659.25, 783.99],
    incorrect: [329.63, 261.63, 196],
    streak: [523.25, 659.25, 783.99, 1046.5],
  },
}));

// Global mock for framer-motion to prevent "Element type is invalid" errors
vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )),
    span: React.forwardRef(({ children, ...props }: any, ref) => (
      <span ref={ref} {...props}>
        {children}
      </span>
    )),
    p: React.forwardRef(({ children, ...props }: any, ref) => (
      <p ref={ref} {...props}>
        {children}
      </p>
    )),
    button: React.forwardRef(({ children, ...props }: any, ref) => (
      <button ref={ref} {...props}>
        {children}
      </button>
    )),
    h2: React.forwardRef(({ children, ...props }: any, ref) => (
      <h2 ref={ref} {...props}>
        {children}
      </h2>
    )),
    h3: React.forwardRef(({ children, ...props }: any, ref) => (
      <h3 ref={ref} {...props}>
        {children}
      </h3>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));
