import * as Sentry from '@sentry/react';

type InitOptions = Parameters<typeof Sentry.init>[0];

/**
 * Initialize Sentry for error tracking, performance monitoring, and session
 * replay. Must be called synchronously before any other module is evaluated
 * (see main.tsx) so import-time errors are captured.
 *
 * Integrations are declared explicitly rather than relying solely on defaults:
 *  - browserTracingIntegration: instruments page navigations and XHR/fetch
 *    spans so that performance data appears in Sentry.
 *  - replayIntegration: records session replays; controlled by
 *    replaysSessionSampleRate / replaysOnErrorSampleRate.
 *
 * Without the explicit integration declarations the sample-rate config values
 * are present in the SDK options but replays and performance spans are never
 * actually recorded.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn('[Sentry] VITE_SENTRY_DSN not set — Sentry is disabled.');
    return;
  }

  const isProd = import.meta.env.PROD;

  const options: InitOptions = {
    dsn,
    environment: import.meta.env.MODE,
    enabled: isProd,
    tracesSampleRate: isProd ? 0.1 : 0.5,
    replaysSessionSampleRate: isProd ? 0.1 : 0,
    replaysOnErrorSampleRate: isProd ? 1.0 : 0,
    integrations: (defaults) => [
      ...defaults,
      // Instruments navigation and XHR/fetch for performance monitoring.
      Sentry.browserTracingIntegration(),
      // Records session replays (requires the sample rates above to be > 0
      // in production to actually record anything).
      Sentry.replayIntegration({
        // Text content is not masked so game words remain readable in replays.
        maskAllText: false,
        // Media (audio playback) is not blocked so TTS issues are visible.
        blockAllMedia: false,
      }),
    ],
  };

  Sentry.init(options);
}

export { Sentry };
