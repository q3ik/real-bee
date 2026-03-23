/**
 * Polyfill Web Streams API globals for Vitest/jsdom environment.
 * Required for msw/node (@mswjs/interceptors) which uses TransformStream
 * at module import time via globalThis — not covered by global or window alone.
 */
import { TransformStream, WritableStream, ReadableStream } from 'node:stream/web';
import { TextEncoder, TextDecoder } from 'node:util';

// Assign to globalThis first — this is what @mswjs/interceptors checks
Object.assign(globalThis, {
  TransformStream,
  WritableStream,
  ReadableStream,
  TextEncoder,
  TextDecoder,
});

// Also assign to global for other Node.js consumers
Object.assign(global, {
  TransformStream,
  WritableStream,
  ReadableStream,
  TextEncoder,
  TextDecoder,
});

// Also assign to window for jsdom environment
if (typeof window !== 'undefined') {
  Object.assign(window, {
    TransformStream,
    WritableStream,
    ReadableStream,
    TextEncoder,
    TextDecoder,
  });
}
