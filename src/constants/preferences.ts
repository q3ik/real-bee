/**
 * Settings UI and user preference constants.
 * Extracted from Settings.tsx and useUserPreferences.ts.
 */

import type {
  GradeLevel,
  PreferenceDifficulty,
  GameDifficulty,
} from "../types";
import type {
  UserPreferences,
  TtsProvider,
} from "../hooks/useUserPreferences.types";

// ---------------------------------------------------------------------------
// Default preferences
// ---------------------------------------------------------------------------

/**
 * Default values for the full UserPreferences object.
 * Used by useUserPreferences for initialization and reset.
 */
export const DEFAULT_PREFERENCES: Readonly<UserPreferences> = {
  grade: "all" as GradeLevel,
  soundEnabled: true,
  soundVolume: 0.8,
  ttsProvider: "web-speech" as TtsProvider,
  micEnabled: true,
  theme: "light" as const,
  difficulty: "all" as GameDifficulty,
  autoSubmit: false,
} as const;

/**
 * Legacy defaults for the older PREFERENCE_DEFAULTS shape.
 * Kept for backward compatibility with existing code paths.
 */
export const PREFERENCE_DEFAULTS = {
  difficulty: "all" as PreferenceDifficulty,
  gradeLevel: "all" as GradeLevel,
  soundEnabled: true,
  autoSubmit: false,
  showWelcomeScreen: false,
  dontShowWelcomeAgain: false,
} as const;

// ---------------------------------------------------------------------------
// TTS provider configuration
// ---------------------------------------------------------------------------

export interface TtsProviderOption {
  label: string;
  value: TtsProvider;
  description: string;
}

/**
 * TTS provider options for the settings UI.
 */
export const TTS_PROVIDER_OPTIONS: TtsProviderOption[] = [
  {
    label: "Web Speech",
    value: "web-speech",
    description: "Browser native (works offline)",
  },
  {
    label: "Gemini",
    value: "gemini",
    description: "Higher quality natural voice",
  },
];

// ---------------------------------------------------------------------------
// Grade level configuration
// ---------------------------------------------------------------------------

export interface GradeOption {
  label: string;
  value: number;
  prefValue: GradeLevel;
}

/**
 * Grade level options for the settings UI.
 * Values (1, 3, 6, 9) correspond exactly to the range-based grade buckets
 * produced by generate-word-databases.js and loaded by wordLoader.
 */
export const GRADE_OPTIONS: GradeOption[] = [
  { label: "K-2", value: 1, prefValue: "K-2" },
  { label: "3-5", value: 3, prefValue: "3-5" },
  { label: "6-8", value: 6, prefValue: "6-8" },
  { label: "9-12", value: 9, prefValue: "9-12" },
  { label: "All", value: 0, prefValue: "all" },
];

// ---------------------------------------------------------------------------
// Difficulty configuration
// ---------------------------------------------------------------------------

export interface DifficultyOption {
  label: string;
  value: string;
  prefValue: PreferenceDifficulty;
}

/**
 * Difficulty options for the settings UI.
 */
export const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  { label: "Easy", value: "easy", prefValue: "easy" },
  { label: "Medium", value: "medium", prefValue: "medium" },
  { label: "Hard", value: "hard", prefValue: "hard" },
  { label: "Mixed", value: "all", prefValue: "all" },
];
