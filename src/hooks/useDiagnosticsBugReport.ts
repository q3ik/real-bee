import { useState, useCallback } from "react";
import { Sentry } from "../lib/sentry";

export interface UseDiagnosticsBugReportOptions {
  /** Feature/component identifier (e.g., 'HighScoresPanel', 'VoiceInput') */
  feature: string;
  /** Error object to include in report */
  error?: Error | null;
  /** Current game state snapshot */
  gameState?: Record<string, unknown>;
  /** User preferences */
  preferences?: Record<string, unknown>;
  /** Any additional context to include */
  additionalContext?: Record<string, unknown>;
}

export interface UseDiagnosticsBugReportResult {
  /**
   * Submit a bug report.
   *
   * @param userDescription - Optional free-text description from the user.
   * @param runtimeContext  - Optional extra context captured at call time
   *   (e.g. a game-state snapshot). Merged into `additionalContext` so
   *   callers don't need to subscribe to high-frequency state at hook level.
   */
  submitReport: (
    userDescription?: string,
    runtimeContext?: Record<string, unknown>,
  ) => Promise<void>;
  isSubmitting: boolean;
  isSubmitted: boolean;
  submitError: string | null;
  deliveryMethod: "sentry" | "localStorage" | null;
  reset: () => void;
}

/**
 * Hook for submitting diagnostic bug reports from error states.
 *
 * Captures full diagnostics via Sentry breadcrumbs and, if the API is
 * unavailable, falls back to localStorage. No LogRocket coupling.
 */
export function useDiagnosticsBugReport({
  feature,
  error,
  gameState = {},
  preferences = {},
  additionalContext = {},
}: UseDiagnosticsBugReportOptions): UseDiagnosticsBugReportResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<
    "sentry" | "localStorage" | null
  >(null);

  const reset = useCallback(() => {
    setIsSubmitted(false);
    setSubmitError(null);
    setDeliveryMethod(null);
  }, []);

  const submitReport = useCallback(
    async (
      userDescription = "",
      runtimeContext: Record<string, unknown> = {},
    ) => {
      setIsSubmitting(true);
      setSubmitError(null);

      // Merge static additionalContext with anything passed at call time.
      const mergedContext = { ...additionalContext, ...runtimeContext };

      try {
        // Build error context
        const errorContext = {
          feature,
          route:
            typeof window !== "undefined"
              ? window.location.pathname
              : "unknown",
          timestamp: new Date().toISOString(),
          ...(error && {
            errorMessage: error.message,
            errorStack: error.stack,
            errorName: error.name,
          }),
          ...mergedContext,
        };

        // Construct diagnostics payload
        const bugReport = {
          type: "bug",
          message:
            userDescription ||
            `Error in ${feature}${error ? `: ${error.message}` : ""}`,
          url: typeof window !== "undefined" ? window.location.href : "unknown",
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
          timestamp: new Date().toISOString(),
          diagnostics: {
            gameState,
            preferences,
            errorContext,
          },
        };

        // Submit to Sentry as a message with full context as extra data
        const eventId = Sentry.captureMessage(bugReport.message, {
          level: "error",
          tags: { "report.type": "bug", "report.feature": feature },
          extra: { bugReport, gameState, preferences, errorContext },
        });

        if (eventId) {
          setDeliveryMethod("sentry");
        } else {
          // Fallback to localStorage
          const storedReports = JSON.parse(
            localStorage.getItem("bug_reports") || "[]",
          );
          storedReports.push(bugReport);
          localStorage.setItem("bug_reports", JSON.stringify(storedReports));
          setDeliveryMethod("localStorage");
        }

        setIsSubmitted(true);
      } catch (err: unknown) {
        console.error("Failed to submit diagnostic bug report:", err);
        setSubmitError((err as Error).message || "Failed to submit bug report");
      } finally {
        setIsSubmitting(false);
      }
    },
    [feature, error, gameState, preferences, additionalContext],
  );

  return {
    submitReport,
    isSubmitting,
    isSubmitted,
    submitError,
    deliveryMethod,
    reset,
  };
}
