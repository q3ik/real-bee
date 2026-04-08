/**
 * Keyboard modifier keys configuration
 */
export interface KeyboardModifiers {
  /**
   * Require Ctrl key to be pressed (or not pressed if false)
   */
  ctrl?: boolean;

  /**
   * Require Meta/Command key to be pressed (or not pressed if false)
   */
  meta?: boolean;

  /**
   * Require Alt/Option key to be pressed (or not pressed if false)
   */
  alt?: boolean;

  /**
   * Require Shift key to be pressed (or not pressed if false)
   */
  shift?: boolean;
}

/**
 * Configuration options for useKeyboardShortcut hook
 */
export interface UseKeyboardShortcutOptions {
  /**
   * Whether the shortcut is enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Whether to ignore shortcuts when typing in input fields
   * @default true
   */
  ignoreInputFields?: boolean;

  /**
   * Required modifier keys for the shortcut
   */
  modifiers?: KeyboardModifiers;
}
