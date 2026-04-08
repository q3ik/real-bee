import { useState, useEffect } from 'react';
import type { UseMicrophonePermissionResult } from './useMicrophonePermission.types';

/**
 * Hook to monitor microphone permission state
 *
 * Uses the Permissions API to track microphone permission changes.
 * Falls back gracefully if the Permissions API is not supported.
 *
 * @returns Permission state and control functions
 *
 * @example
 * ```tsx
 * function VoiceInput() {
 *   const { permissionDenied, resetPermission } = useMicrophonePermission();
 *
 *   if (permissionDenied) {
 *     return (
 *       <div>
 *         <p>Microphone access denied</p>
 *         <button onClick={resetPermission}>Try Again</button>
 *       </div>
 *     );
 *   }
 *
 *   return <button>Start Recording</button>;
 * }
 * ```
 */
export function useMicrophonePermission(): UseMicrophonePermissionResult {
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);

  useEffect(() => {
    let permissionStatus: PermissionStatus | null = null;
    let isMounted = true;

    const handlePermissionChange = (): void => {
      if (!permissionStatus) return;

      if (permissionStatus.state === 'denied') {
        setPermissionDenied(true);
      } else if (permissionStatus.state === 'granted' || permissionStatus.state === 'prompt') {
        setPermissionDenied(false);
      }
    };

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((status: PermissionStatus) => {
          if (!isMounted) return;
          permissionStatus = status;
          if (status.state === 'denied') {
            setPermissionDenied(true);
          }
          status.addEventListener('change', handlePermissionChange);
        })
        .catch(() => {
          // Permission API not supported, fail silently
        });
    }

    return () => {
      isMounted = false;
      if (permissionStatus) {
        permissionStatus.removeEventListener('change', handlePermissionChange);
      }
    };
  }, []);

  const resetPermission = (): void => {
    setPermissionDenied(false);
  };

  const markPermissionDenied = (): void => {
    setPermissionDenied(true);
  };

  return { permissionDenied, resetPermission, markPermissionDenied };
}

// Re-export types for convenience
export type { UseMicrophonePermissionResult } from './useMicrophonePermission.types';
