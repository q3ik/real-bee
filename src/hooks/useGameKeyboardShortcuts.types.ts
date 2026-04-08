/**
 * Game phase states — single source of truth for game FSM phases.
 * Mirrors the phase values stored in useGameStore.
 */
export type GamePhase = "idle" | "playing" | "round_end";

/**
 * Configuration for useGameKeyboardShortcuts hook
 */
export interface UseGameKeyboardShortcutsConfig {
  gameState: GamePhase;
  onRepeatWord?: () => void;
  onHint: () => void;
  onDefinition: () => void;
  onSentence: () => void;
}
