/**
 * Re-export GamePhase from the canonical FSM types file so that
 * useGameKeyboardShortcuts does not define its own copy.
 */
export type { GamePhase } from './useGameState.types';

/**
 * Configuration for useGameKeyboardShortcuts hook
 */
export interface UseGameKeyboardShortcutsConfig {
  gameState: import('./useGameState.types').GamePhase;
  onRepeatWord?: () => void;
  onHint: () => void;
  onDefinition: () => void;
  onSentence: () => void;
}
