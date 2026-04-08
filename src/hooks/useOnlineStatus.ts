import { useSyncExternalStore } from 'react';

const subscribe = (callback: () => void): (() => void) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};

const getSnapshot = (): boolean => {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
};

const getServerSnapshot = (): boolean => true;

/**
 * Hook to track online/offline status
 *
 * Monitors the browser's network connectivity state using navigator.onLine
 * and window online/offline events. Updates state reactively when connection
 * status changes.
 *
 * @returns Current online status (true = online, false = offline)
 *
 * @example
 * ```jsx
 * function MyComponent() {
 *   const isOnline = useOnlineStatus();
 *
 *   return (
 *     <div>
 *       {isOnline ? (
 *         <span>✅ Connected</span>
 *       ) : (
 *         <span>⚠️ Offline Mode</span>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Re-export types for convenience
export type { UseOnlineStatusResult } from './useOnlineStatus.types';
