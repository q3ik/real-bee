import * as Sentry from '@sentry/react';

type InitOptions = Parameters<typeof Sentry.init>[0];

/**
 * Initialize Sentry for error tracking and performance monitoring.
 * Must be called before any other code runs (typically at the top of main.tsx).
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn('[Sentry] VITE_SENTRY_DSN not set — Sentry is disabled.');
    return;
  }

  const options: InitOptions = {
    dsn,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 0.5,
    replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
    integrations: (defaults) => [
      ...defaults,
    ],
  };

  Sentry.init(options);
}

export { Sentry };
