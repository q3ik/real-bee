import { useState, useRef, useCallback, useEffect } from 'react';
import type { UseCountdownOptions, UseCountdownResult } from './useCountdown.types';

/**
 * Hook to manage countdown timer with precise interval updates
 *
 * Provides accurately countdown functionality using Date.now() for precision
 * rather than relying solely on setInterval timing, which can drift.
 *
 * @param maxDuration - Maximum duration in milliseconds
 * @param options - Optional configuration
 * @returns Countdown state and control functions
 *
 * @example
 * ```tsx
 * function GameTimer() {
 *   const { remaining, percent, start, stop, reset } = useCountdown(30000, {
 *     onComplete: () => console.log('Time\'s up!')
 *   });
 *
 *   return (
 *     <div>
 *       <p>Time left: {Math.ceil(remaining / 1000)}s</p>
 *       <progress value={percent} max={100} />
 *       <button onClick={start}>Start</button>
 *       <button onClick={stop}>Stop</button>
 *       <button onClick={reset}>Reset</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCountdown(
  maxDuration: number,
  options: UseCountdownOptions = {}
): UseCountdownResult {
  const { onComplete } = options;
  const [remaining, setRemaining] = useState<number>(maxDuration);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const onCompleteRef = useRef<(() => void) | undefined>(onComplete);

  // Keep onComplete ref up to date
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const stop = useCallback((): void => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback((): void => {
    stop();
    setRemaining(maxDuration);
    startTimeRef.current = null;
  }, [maxDuration, stop]);

  const start = useCallback((): void => {
    reset();
    startTimeRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - (startTimeRef.current ?? 0);
      const newRemaining = Math.max(maxDuration - elapsed, 0);
      setRemaining(newRemaining);

      if (newRemaining <= 0) {
        stop();
        if (onCompleteRef.current) {
          onCompleteRef.current();
        }
      }
    }, 100);
  }, [maxDuration, reset, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const percent = Math.max((remaining / maxDuration) * 100, 0);

  return {
    remaining,
    percent,
    start,
    stop,
    reset,
  };
}

// Re-export types for convenience
export type { UseCountdownOptions, UseCountdownResult } from './useCountdown.types';
