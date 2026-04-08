import { useEffect } from 'react';
import type { UseGameKeyboardShortcutsConfig } from './useGameKeyboardShortcuts.types';

/**
 * Manage keyboard shortcuts for game controls.
 * Only active when gameState is 'playing' and focus is not on input/button elements.
 *
 * Shortcuts:
 * - Space: Repeat word
 * - H: Give hint
 * - D: Give definition
 * - S: Give sentence
 */
export function useGameKeyboardShortcuts(config: UseGameKeyboardShortcutsConfig): void {
  const { gameState, onRepeatWord, onHint, onDefinition, onSentence } = config;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (gameState !== 'playing') return;

      const element = e.target as HTMLElement | null;
      if (element) {
        if (element.isContentEditable) return;

        const tagName = element.tagName?.toLowerCase();

        // Block shortcuts when typing in inputs or when any button has focus
        if (['input', 'textarea', 'select', 'button'].includes(tagName)) {
          return;
        }
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          onRepeatWord?.();
          break;
        case 'h':
          e.preventDefault();
          onHint();
          break;
        case 'd':
          e.preventDefault();
          onDefinition();
          break;
        case 's':
          e.preventDefault();
          onSentence();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, onRepeatWord, onHint, onDefinition, onSentence]);
}

// Re-export types for convenience
export type {
  GamePhase,
  UseGameKeyboardShortcutsConfig,
} from './useGameKeyboardShortcuts.types';
