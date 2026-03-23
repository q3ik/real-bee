/**
 * Sanity test for TransformStream polyfill
 * 
 * Verifies that the TransformStream API is available and functional
 * in the test environment. This catches regressions in the polyfill setup.
 */
import { describe, it, expect } from 'vitest';

describe('Test environment setup', () => {
  it('has TransformStream available', () => {
    expect(globalThis.TransformStream).toBeDefined();
    expect(typeof TransformStream).toBe('function');
  });

  it('can instantiate TransformStream', () => {
    expect(() => new TransformStream()).not.toThrow();
  });

  it('TransformStream has correct API shape', () => {
    const stream = new TransformStream();
    expect(stream.readable).toBeDefined();
    expect(stream.writable).toBeDefined();
    expect(stream.readable).toBeInstanceOf(ReadableStream);
    expect(stream.writable).toBeInstanceOf(WritableStream);
  });

  it('TransformStream can transform data', async () => {
    const transform = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk.toUpperCase());
      },
    });

    const writer = transform.writable.getWriter();
    const reader = transform.readable.getReader();

    // Write data
    writer.write('test');
    writer.close();

    // Read transformed data
    const { value } = await reader.read();
    expect(value).toBe('TEST');
  });
});
