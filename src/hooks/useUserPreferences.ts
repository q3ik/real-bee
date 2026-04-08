import { useCallback, useEffect, useState } from "react";
import { localDb } from "../lib/db";
import { PREFERENCE_DEFAULTS } from "../constants/preferences";
import type {
  PreferenceDifficulty,
  GradeLevel,
  UserPreferencesConfig,
  UserPreferencesState,
} from "./useUserPreferences.types";

/**
 * Check if test mode is enabled via VITE_TEST_MODE environment variable.
 *
 * Test mode bypasses welcome screens and other UI flows that interfere with automated testing.
 *
 * @returns true if VITE_TEST_MODE === 'true' (strict string comparison)
 */
const isTestModeEnabled = (): boolean =>
  (import.meta as any).env?.VITE_TEST_MODE === "true";

/**
 * Loads and persists user preferences via Dexie (IndexedDB) and exposes typed preference handlers.
 */
export function useUserPreferences({
  userId,
  onDifficultyChange,
  onGradeLevelChange,
}: UserPreferencesConfig): UserPreferencesState {
  const [difficulty, setDifficulty] = useState<PreferenceDifficulty>(
    PREFERENCE_DEFAULTS.difficulty,
  );
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>(PREFERENCE_DEFAULTS.gradeLevel);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    PREFERENCE_DEFAULTS.soundEnabled,
  );
  const [showWelcomeScreen, setShowWelcomeScreen] = useState<boolean>(false);
  const [dontShowWelcomeAgain, setDontShowWelcomeAgain] =
    useState<boolean>(false);
  const [autoSubmit, setAutoSubmit] = useState<boolean>(PREFERENCE_DEFAULTS.autoSubmit);
  const [hasLoadedPreference, setHasLoadedPreference] =
    useState<boolean>(false);
  const [loadedPreferenceUserId, setLoadedPreferenceUserId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (userId) {
      setHasLoadedPreference(false);

      const loadPrefs = async () => {
        const saved = await localDb.preferences
          .where("uid")
          .equals(userId)
          .first();

        setDifficulty(
          (saved?.difficulty as PreferenceDifficulty) || PREFERENCE_DEFAULTS.difficulty,
        );
        setGradeLevel((saved?.gradeLevel as GradeLevel) || PREFERENCE_DEFAULTS.gradeLevel);
        setSoundEnabled(saved?.soundEnabled ?? PREFERENCE_DEFAULTS.soundEnabled);
        setAutoSubmit(saved?.autoSubmit ?? PREFERENCE_DEFAULTS.autoSubmit);

        if (isTestModeEnabled()) {
          setShowWelcomeScreen(false);
          setDontShowWelcomeAgain(true);
        } else {
          const shouldShowWelcome = saved?.showWelcomeScreen ?? true;
          setShowWelcomeScreen(shouldShowWelcome);
          setDontShowWelcomeAgain(!shouldShowWelcome);
        }

        setHasLoadedPreference(true);
        setLoadedPreferenceUserId(userId);
      };

      void loadPrefs();
      return;
    }

    setDifficulty(PREFERENCE_DEFAULTS.difficulty);
    setGradeLevel(PREFERENCE_DEFAULTS.gradeLevel);
    setSoundEnabled(PREFERENCE_DEFAULTS.soundEnabled);
    setAutoSubmit(PREFERENCE_DEFAULTS.autoSubmit);
    setHasLoadedPreference(false);
    setShowWelcomeScreen(PREFERENCE_DEFAULTS.showWelcomeScreen);
    setDontShowWelcomeAgain(PREFERENCE_DEFAULTS.dontShowWelcomeAgain);
    setLoadedPreferenceUserId(null);
  }, [userId]);

  useEffect(() => {
    if (userId && hasLoadedPreference && loadedPreferenceUserId === userId) {
      void (async () => {
        const existing = await localDb.preferences
          .where("uid")
          .equals(userId)
          .first();
        if (existing) {
          await localDb.preferences.update(existing.id!, {
            difficulty,
            gradeLevel,
            soundEnabled,
            autoSubmit,
          });
        } else {
          await localDb.preferences.add({
            uid: userId,
            difficulty,
            gradeLevel,
            soundEnabled,
            autoSubmit,
            showWelcomeScreen,
            dontShowWelcomeAgain,
          });
        }
      })();
    }
  }, [
    userId,
    difficulty,
    gradeLevel,
    soundEnabled,
    autoSubmit,
    hasLoadedPreference,
    loadedPreferenceUserId,
    showWelcomeScreen,
    dontShowWelcomeAgain,
  ]);

  const handleDifficultySelect = useCallback(
    (value: PreferenceDifficulty) => {
      setDifficulty(value);
      onDifficultyChange?.(value);
    },
    [onDifficultyChange],
  );

  const handleGradeLevelSelect = useCallback(
    (value: GradeLevel) => {
      setGradeLevel(value);
      onGradeLevelChange?.(value);
    },
    [onGradeLevelChange],
  );

  const handleCloseWelcome = useCallback(() => {
    if (userId) {
      const shouldShowWelcome = !dontShowWelcomeAgain;
      void (async () => {
        const existing = await localDb.preferences
          .where("uid")
          .equals(userId)
          .first();
        if (existing) {
          await localDb.preferences.update(existing.id!, {
            showWelcomeScreen: shouldShowWelcome,
          });
        }
      })();
    }
    setShowWelcomeScreen(false);
  }, [userId, dontShowWelcomeAgain]);

  return {
    difficulty,
    gradeLevel,
    soundEnabled,
    setSoundEnabled,
    autoSubmit,
    setAutoSubmit,
    showWelcomeScreen,
    setShowWelcomeScreen,
    dontShowWelcomeAgain,
    setDontShowWelcomeAgain,
    handleCloseWelcome,
    handleDifficultySelect,
    handleGradeLevelSelect,
  };
}

// Re-export types for convenience
export type {
  PreferenceDifficulty,
  GradeLevel,
  UserPreferencesConfig,
  UserPreferencesState,
} from "./useUserPreferences.types";
