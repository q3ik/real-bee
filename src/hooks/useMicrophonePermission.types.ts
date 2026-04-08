/**
 * Return type for useMicrophonePermission hook
 */
export interface UseMicrophonePermissionResult {
  /**
   * Whether microphone permission has been denied by the user
   */
  permissionDenied: boolean;

  /**
   * Reset the permission denied state to false
   */
  resetPermission: () => void;

  /**
   * Manually mark permission as denied (e.g. after catching a browser error)
   */
  markPermissionDenied: () => void;
}
