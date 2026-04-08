import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Sentry } from '../lib/sentry';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  sentryEventId: string | null;
}

/**
 * ErrorBoundary component that catches React rendering errors,
 * reports them to Sentry, and shows a user-friendly fallback UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      sentryEventId: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      sentryEventId: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Capture synchronously so the event is recorded even if flush fails.
    const eventId = Sentry.captureException(error, {
      extra: { componentStack: errorInfo.componentStack },
    });

    // Store the eventId immediately — do not wait for the flush.
    this.setState({ sentryEventId: eventId ?? null });

    // Fire-and-forget flush: detach the promise and swallow any rejection
    // so a Sentry network failure cannot become an unhandled promise
    // rejection on top of an already-broken render.
    void Sentry.flush(2000).catch(() => {
      // Intentionally ignored — the event was already captured above.
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="p-6 bg-red-50 rounded-full inline-block">
              <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-gray-800">Something went wrong</h2>
            <p className="text-gray-500">
              An unexpected error occurred. The error has been reported.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all"
            >
              Reload the game
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
