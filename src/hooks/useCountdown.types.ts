/**
 * Configuration options for useCountdown hook
 */
export interface UseCountdownOptions {
  /**
   * Callback function to execute when countdown reaches zero
   */
  onComplete?: () => void;
}

/**
 * Return type for useCountdown hook
 */
export interface UseCountdownResult {
  /**
   * Remaining time in milliseconds
   */
  remaining: number;

  /**
   * Remaining time as a percentage (0-100)
   */
  percent: number;

  /**
   * Start or restart the countdown timer
   */
  start: () => void;

  /**
   * Stop the countdown timer
   */
  stop: () => void;

  /**
   * Reset the countdown timer to initial duration
   */
  reset: () => void;
}
