/**
 * MSW Server Setup for Test Environment
 * 
 * This file configures Mock Service Worker (MSW) for the Node.js test
 * environment. MSW intercepts network requests and returns mock responses,
 * preventing ECONNREFUSED errors and enabling offline testing.
 * 
 * Part of Phase 1 for issue #626
 */

import { setupServer } from 'msw/node';
import type { RequestHandler } from 'msw';
import { handlers } from './handlers';

/**
 * Create and export the mock server with default handlers
 * 
 * The server is configured to:
 * - Intercept all network requests matching our handlers
 * - Log warnings for unhandled requests (helps identify missing mocks)
 * - Allow tests to add custom handlers via server.use()
 */
export const server = setupServer(...handlers);

/**
 * Configure server behavior
 */
server.events.on('request:start', ({ request }) => {
  // Optional: Log all intercepted requests for debugging
  // Uncomment during development if you need to see what's being intercepted
  // console.log('MSW intercepted:', request.method, request.url);
});

server.events.on('request:unhandled', ({ request }) => {
  // Warn about unhandled requests - these might need mocking
  const url = new URL(request.url);
  
  // Only warn about localhost requests (ignore external APIs)
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    console.warn(
      `[MSW] Warning: Unhandled ${request.method} request to ${request.url}\n` +
      'Consider adding a handler for this endpoint in tests/mocks/handlers.js'
    );
  }
});

/**
 * Helper to reset all runtime handlers added during tests
 * Call this in afterEach() if tests add custom handlers
 */
export function resetServerHandlers() {
  server.resetHandlers();
}

/**
 * Helper to add runtime handlers for specific tests
 * 
 * @example
 * import { server, addRuntimeHandlers } from '@/tests/mocks/server';
 * import { http, HttpResponse } from 'msw';
 * 
 * test('handles custom endpoint', () => {
 *   addRuntimeHandlers(
 *     http.get('http://localhost:8788/api/custom', () => {
 *       return HttpResponse.json({ data: 'custom' });
 *     })
 *   );
 *   // ... test code
 * });
 */
export function addRuntimeHandlers(...runtimeHandlers: RequestHandler[]) {
  server.use(...runtimeHandlers);
}

/**
 * Helper to restore original handlers
 * Useful after overriding handlers in specific tests
 */
export function restoreHandlers() {
  server.restoreHandlers();
}
