/**
 * Difficulty levels for user preferences
 */
export type PreferenceDifficulty = 'easy' | 'medium' | 'hard' | 'all';

/**
 * Grade level options
 */
export type GradeLevel = 'K-2' | '3-5' | '6-8' | 'all';

/**
 * Configuration for useUserPreferences hook
 */
export interface UserPreferencesConfig {
  userId: string | null;
  onDifficultyChange?: (difficulty: PreferenceDifficulty) => void;
  onGradeLevelChange?: (gradeLevel: GradeLevel) => void;
}

/**
 * Return type for useUserPreferences hook
 */
export interface UserPreferencesState {
  difficulty: PreferenceDifficulty;
  gradeLevel: GradeLevel;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  autoSubmit: boolean;
  setAutoSubmit: (enabled: boolean) => void;
  showWelcomeScreen: boolean;
  setShowWelcomeScreen: (show: boolean) => void;
  dontShowWelcomeAgain: boolean;
  setDontShowWelcomeAgain: (skip: boolean) => void;
  handleCloseWelcome: () => void;
  handleDifficultySelect: (value: PreferenceDifficulty) => void;
  handleGradeLevelSelect: (value: GradeLevel) => void;
}
