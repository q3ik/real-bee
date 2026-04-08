import { useCallback, useEffect, useState } from 'react';
import type {
  SummaryAction,
  UseSessionManagerParams,
  UseSessionManagerReturn,
} from './useSessionManager.types';

/**
 * Valid actions for the session summary dialog.
 */
export const SUMMARY_ACTIONS = {
  LOGOUT: 'logout' as const,
  RESTART: 'restart' as const,
};

/**
 * Hook to manage session summary dialog state and actions.
 *
 * Shows a post-session summary dialog (end of round statistics)
 * with options to restart or log out.
 */
export function useSessionManager({
  logout,
  restartGame,
}: UseSessionManagerParams): UseSessionManagerReturn {
  const [summaryOpen, setSummaryOpen] = useState<boolean>(false);
  const [summaryAction, setSummaryAction] = useState<SummaryAction | null>(null);

  /**
   * Opens the summary dialog with the specified action.
   */
  const openSummary = useCallback((action: SummaryAction) => {
    if (action && !Object.values(SUMMARY_ACTIONS).includes(action as SummaryAction)) {
      console.warn(`Invalid summary action: ${action}. Expected one of: ${Object.values(SUMMARY_ACTIONS).join(', ')}`);
      return;
    }
    setSummaryAction(action);
    setSummaryOpen(Boolean(action));
  }, []);

  /**
   * Closes the summary dialog without taking action.
   */
  const closeSummary = useCallback(() => {
    setSummaryOpen(false);
    setSummaryAction(null);
  }, []);

  const handleSummaryConfirm = useCallback(() => {
    const action = summaryAction;
    setSummaryOpen(false);
    setSummaryAction(null);

    if (action === SUMMARY_ACTIONS.LOGOUT) {
      logout();
      return;
    }

    if (action === SUMMARY_ACTIONS.RESTART) {
      restartGame();
      return;
    }
  }, [summaryAction, logout, restartGame]);

  const handleLogoutClick = useCallback(() => {
    openSummary(SUMMARY_ACTIONS.LOGOUT);
  }, [openSummary]);

  return {
    summaryOpen,
    summaryAction,
    openSummary,
    closeSummary,
    handleSummaryConfirm,
    handleLogoutClick,
  };
}

// Re-export types for convenience
export type {
  SummaryAction,
  UseSessionManagerParams,
  UseSessionManagerReturn,
} from './useSessionManager.types';
