/**
 * Valid summary action types
 */
export type SummaryAction = 'logout' | 'restart';

/**
 * Parameters for useSessionManager hook
 */
export interface UseSessionManagerParams {
  logout: () => void;
  restartGame: () => void;
}

/**
 * Return type for useSessionManager hook
 */
export interface UseSessionManagerReturn {
  summaryOpen: boolean;
  summaryAction: SummaryAction | null;
  openSummary: (action: SummaryAction) => void;
  closeSummary: () => void;
  handleSummaryConfirm: () => void;
  handleLogoutClick: () => void;
}
