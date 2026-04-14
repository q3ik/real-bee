/**
 * Base HTTP client with AbortController timeout, retries, and typed errors.
 *
 * All API requests should use `apiRequest` to benefit from:
 *  - Automatic timeout via AbortController (configurable per-request)
 *  - Retry logic with exponential backoff (configurable)
 *  - Typed ApiError / TimeoutError on failures
 *  - JSON request/response serialization
 *  - Automatic Sentry error capture on final failure (after all retries)
 */

import { ApiError, TimeoutError } from "./types";
import { Sentry } from "../lib/sentry";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ApiRequestOptions {
  /** Request timeout in milliseconds (default: 10_000) */
  timeoutMs?: number;
  /** Number of retry attempts on failure (default: 0) */
  retries?: number;
  /** Base delay between retries in ms (default: 1_000, doubled each retry) */
  retryDelayMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 0;
const DEFAULT_RETRY_DELAY_MS = 1_000;

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/** Sleep for a given number of milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a single fetch request with an AbortController timeout.
 * Throws TimeoutError if the request exceeds the timeout.
 * Throws ApiError for non-2xx responses.
 */
async function fetchWithTimeout<T>(
  endpoint: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = `API error: ${response.status}`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // Ignore JSON parse failures — status code is enough
      }
      throw new ApiError(message, response.status, endpoint);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new TimeoutError(endpoint, timeoutMs, error);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    // Network errors, DNS failures, etc.
    throw new ApiError(
      `Network error: ${(error as Error).message}`,
      0,
      endpoint,
      error,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Make an API request with timeout, optional retries, and typed errors.
 *
 * Errors are reported to Sentry only on the final attempt so that
 * transient failures that resolve within the retry window do not create
 * noise. Network errors (status 0) and timeouts are reported at `warning`
 * level; server-side errors (4xx/5xx) at `error` level.
 *
 * The Sentry `extra` payload includes:
 *  - `retries`   — the configured maximum retry count
 *  - `attempt`   — total attempts made (retries + 1), useful for
 *                  distinguishing first-attempt failures from
 *                  retry-exhausted failures in production dashboards
 *  - `timeoutMs` — per-request timeout
 *
 * @param endpoint - The URL to fetch (e.g., '/api/tts')
 * @param body - The request body (will be JSON-serialized)
 * @param options - Timeout, retries, and retry delay configuration
 * @returns Parsed JSON response
 * @throws {ApiError} On non-2xx responses or network failures
 * @throws {TimeoutError} When the request exceeds the timeout
 */
export async function apiRequest<T>(
  endpoint: string,
  body: unknown,
  options: ApiRequestOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };

  let lastError: unknown;
  let attempt = 0;

  for (; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout<T>(endpoint, init, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const delay = retryDelayMs * 2 ** attempt;
        await sleep(delay);
      }
    }
  }

  // All attempts exhausted — report to Sentry before re-throwing.
  // Network/timeout errors are expected in offline scenarios; use `warning`
  // so they don't inflate the error rate. Server errors (4xx/5xx) use
  // `error` as they indicate a real problem on the server side.
  const isNetworkOrTimeout =
    lastError instanceof TimeoutError ||
    (lastError instanceof ApiError && lastError.status === 0);

  Sentry.captureException(lastError, {
    level: isNetworkOrTimeout ? 'warning' : 'error',
    tags: { 'api.endpoint': endpoint },
    extra: {
      retries,
      // `attempt` is the total number of attempts made (retries + 1).
      // Including this lets engineers distinguish first-attempt failures
      // from retry-exhausted failures in Sentry's issue detail view.
      attempt,
      timeoutMs,
    },
  });

  throw lastError ?? new ApiError("Unknown error", 0, endpoint);
}
