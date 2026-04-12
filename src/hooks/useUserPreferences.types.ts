/**
 * Type definitions for user preferences and the useUserPreferences hook.
 *
 * Provides typed interfaces for preference management including
 * sound settings, TTS provider selection, grade level, and difficulty.
 */

import type { GameDifficulty, GradeLevel } from "../types";

// ---------------------------------------------------------------------------
// Preference key names (matches LocalUserPreferences fields in db.ts)
// ---------------------------------------------------------------------------

/**
 * Preference keys that can be updated via the SettingsPanel.
 * Excludes welcome screen flags and internal state.
 */
export type PreferenceKey =
  | "gradeLevel"
  | "difficulty"
  | "soundEnabled"
  | "soundVolume"
  | "ttsProvider"
  | "autoSubmit";

/**
 * Available TTS (text-to-speech) providers.
 * - 'web-speech': Browser native SpeechSynthesis API
 * - 'gemini': Gemini TTS via worker (higher quality)
 */
export type TtsProvider = "web-speech" | "gemini";

// ---------------------------------------------------------------------------
// UserPreferences — full shape for IndexedDB / Supabase sync
// ---------------------------------------------------------------------------

/**
 * Complete user preference object stored in IndexedDB.
 * Each field maps to a controllable setting in the SettingsPanel.
 */
export interface UserPreferences {
  /** Grade level filter for word selection (e.g., 'K-2', '3-5', 'all') */
  grade: GradeLevel;
  /** Whether sound effects and TTS are enabled */
  soundEnabled: boolean;
  /** Volume level for sound effects (0.0 – 1.0) */
  soundVolume: number;
  /** TTS provider to use for speech synthesis */
  ttsProvider: TtsProvider;
  /** Whether the microphone is enabled for voice input */
  micEnabled: boolean;
  /** UI theme preference (reserved for future use) */
  theme: "light" | "dark" | "auto";
  /** Game difficulty level */
  difficulty: GameDifficulty;
  /** Whether to auto-submit answers when voice input is detected */
  autoSubmit: boolean;
}

// ---------------------------------------------------------------------------
// Hook configuration and return types
// ---------------------------------------------------------------------------

/**
 * Configuration options for the useUserPreferences hook.
 */
export interface UseUserPreferencesConfig {
  /** User ID for loading/syncing preferences (legacy — now auto-resolved from useGameStore) */
  userId?: string | null;
  /** Optional callback when difficulty changes (for legacy integration) */
  onDifficultyChange?: (difficulty: GameDifficulty) => void;
  /** Optional callback when grade level changes (for legacy integration) */
  onGradeLevelChange?: (grade: GradeLevel) => void;
}

/**
 * Return type for the useUserPreferences hook.
 */
export interface UseUserPreferencesReturn {
  /** Current preference values */
  preferences: UserPreferences;
  /** Update a single preference by key */
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void;
  /** Reset all preferences to defaults */
  resetPreferences: () => void;
  /** Whether preferences are loading from storage */
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Legacy aliases (re-exported from types/index.ts for backward compat)
// ---------------------------------------------------------------------------

export type { GameDifficulty as PreferenceDifficulty } from "../types";
export type { GradeLevel } from "../types";
