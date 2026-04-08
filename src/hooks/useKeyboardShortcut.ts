import { useEffect } from 'react';
import type { UseKeyboardShortcutOptions } from './useKeyboardShortcut.types';

/**
 * Hook to register a keyboard shortcut handler
 *
 * Listens for specific key combinations and triggers a callback.
 * Automatically prevents default behavior and handles modifiers.
 *
 * @param key - Key to listen for (e.g., 'Enter', 'Escape', 'ArrowUp')
 * @param callback - Function to call when the shortcut is triggered
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * function SearchBox() {
 *   const [query, setQuery] = useState('');
 *
 *   // Ctrl+K to focus search
 *   useKeyboardShortcut('k', () => {
 *     document.getElementById('search')?.focus();
 *   }, {
 *     modifiers: { ctrl: true }
 *   });
 *
 *   // Escape to clear search
 *   useKeyboardShortcut('Escape', () => setQuery(''));
 *
 *   return <input id="search" value={query} onChange={e => setQuery(e.target.value)} />;
 * }
 * ```
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: UseKeyboardShortcutOptions = {}
): void {
  const {
    enabled = true,
    ignoreInputFields = true,
    modifiers = {},
  } = options;

  useEffect(() => {
    if (!enabled) return undefined;

    const handleKeyDown = (event: KeyboardEvent): void => {
      // Check if typing in input field
      if (ignoreInputFields) {
        const activeTag = document.activeElement?.tagName;
        const isTypingField = activeTag === 'INPUT' || activeTag === 'TEXTAREA';
        if (isTypingField) return;
      }

      // Check key match
      if (event.key !== key) return;

      // Check modifiers
      if (modifiers.ctrl !== undefined && event.ctrlKey !== modifiers.ctrl) return;
      if (modifiers.meta !== undefined && event.metaKey !== modifiers.meta) return;
      if (modifiers.alt !== undefined && event.altKey !== modifiers.alt) return;
      if (modifiers.shift !== undefined && event.shiftKey !== modifiers.shift) return;

      // Prevent repeats
      if (event.repeat) return;

      event.preventDefault();
      callback();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [key, callback, enabled, ignoreInputFields, modifiers]);
}

// Re-export types for convenience
export type { KeyboardModifiers, UseKeyboardShortcutOptions } from './useKeyboardShortcut.types';
