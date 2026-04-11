import { useCallback, useEffect, useState, useMemo } from "react";
import {
  saveUserPreferences,
  loadUserPreferences,
} from "../game-engine/storage";
import { DEFAULT_PREFERENCES } from "../constants/preferences";
import { soundManager } from "../game-engine/SoundManager";
import { audioManager } from "../lib/audioManager";
import { useGameStore } from "./useGameStore";
import type {
  UserPreferences,
  UseUserPreferencesConfig,
  UseUserPreferencesReturn,
  TtsProvider,
  GradeLevel,
} from "./useUserPreferences.types";
import type { GameDifficulty } from "../types";

/**
 * Generate a stable offline UID for preference storage when no user is authenticated.
 */
function getOfflineUid(): string {
  try {
    const existing = localStorage.getItem("real-bee-offline-uid");
    if (existing) return existing;
    const uid = `offline-${crypto.randomUUID()}`;
    localStorage.setItem("real-bee-offline-uid", uid);
    return uid;
  } catch {
    return "offline-fallback";
  }
}

/**
 * Map stored LocalUserPreferences fields to the UserPreferences interface.
 * Handles migration from legacy field values and applies defaults for missing fields.
 */
function mapFromStorage(stored: Partial<UserPreferences>): UserPreferences {
  return {
    grade: (stored.grade as GradeLevel) ?? DEFAULT_PREFERENCES.grade,
    soundEnabled: stored.soundEnabled ?? DEFAULT_PREFERENCES.soundEnabled,
    soundVolume: stored.soundVolume ?? DEFAULT_PREFERENCES.soundVolume,
    ttsProvider:
      (stored.ttsProvider as TtsProvider) ?? DEFAULT_PREFERENCES.ttsProvider,
    micEnabled: stored.micEnabled ?? DEFAULT_PREFERENCES.micEnabled,
    theme: stored.theme ?? DEFAULT_PREFERENCES.theme,
    difficulty:
      (stored.difficulty as GameDifficulty) ?? DEFAULT_PREFERENCES.difficulty,
    autoSubmit: stored.autoSubmit ?? DEFAULT_PREFERENCES.autoSubmit,
  };
}

/**
 * Loads, persists, and manages user preferences via IndexedDB (storage.ts).
 *
 * Integrates with:
 * - `soundManager.setEnabled()` when `soundEnabled` changes
 * - `audioManager.setMuted()` when `soundEnabled` changes
 * - `audioManager.setVoiceQuality()` when `ttsProvider` changes
 * - `useGameStore` setters for difficulty, grade, autoSubmit, and mute state
 *
 * @param config - Optional callbacks for legacy integration
 * @returns preferences object and manipulation helpers
 */
export function useUserPreferences(
  config?: UseUserPreferencesConfig,
): UseUserPreferencesReturn {
  const [preferences, setPreferences] =
    useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Access Zustand store setters for sync
  const setStoreDifficulty = useGameStore((s) => s.setDifficulty);
  const setStoreGradeLevel = useGameStore((s) => s.setGradeLevel);
  const setStoreMuted = useGameStore((s) => s.setMuted);
  const setStoreAutoSubmit = useGameStore((s) => s.setAutoSubmit);
  const setStoreVoiceQuality = useGameStore((s) => s.setVoiceQuality);

  // Resolve user ID (authenticated or offline)
  const userId = useGameStore((s) => s.userId);
  const effectiveUid = useMemo(() => userId ?? getOfflineUid(), [userId]);

  // Load preferences from IndexedDB on mount or when userId changes
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const load = async () => {
      const stored = await loadUserPreferences(effectiveUid);
      if (cancelled) return;

      const mapped = stored
        ? mapFromStorage({
            grade: stored.gradeLevel as GradeLevel,
            difficulty: stored.difficulty as GameDifficulty,
            soundEnabled: stored.soundEnabled,
            soundVolume: stored.soundVolume,
            ttsProvider: stored.ttsProvider as TtsProvider,
            micEnabled: stored.micEnabled,
            theme: stored.theme as "light" | "dark" | "auto",
            autoSubmit: stored.autoSubmit,
          })
        : { ...DEFAULT_PREFERENCES };

      setPreferences(mapped);
      setIsLoading(false);

      // Sync loaded preferences to downstream systems so that persisted
      // settings take effect immediately (not only after the next interaction).
      const gradeMap: Record<GradeLevel, number> = {
        "K-2": 1,
        "3-5": 3,
        "6-8": 6,
        "9-12": 9,
        all: 0,
      };
      setStoreMuted(!mapped.soundEnabled);
      soundManager.setEnabled?.(mapped.soundEnabled);
      audioManager.setMuted(!mapped.soundEnabled);
      audioManager.setVoiceQuality(
        mapped.ttsProvider === "gemini" ? "natural" : "standard",
      );
      setStoreVoiceQuality(
        mapped.ttsProvider === "gemini" ? "natural" : "standard",
      );
      setStoreDifficulty(mapped.difficulty);
      setStoreGradeLevel(gradeMap[mapped.grade] ?? 1);
      setStoreAutoSubmit(mapped.autoSubmit);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    effectiveUid,
    setStoreMuted,
    setStoreDifficulty,
    setStoreGradeLevel,
    setStoreAutoSubmit,
    setStoreVoiceQuality,
  ]);

  /**
   * Persist current preferences to IndexedDB.
   * Fire-and-forget — storage failures are logged but don't break the UI.
   */
  const persistToStorage = useCallback(
    async (prefs: UserPreferences) => {
      try {
        await saveUserPreferences({
          uid: effectiveUid,
          difficulty: prefs.difficulty,
          gradeLevel: prefs.grade,
          soundEnabled: prefs.soundEnabled,
          soundVolume: prefs.soundVolume,
          ttsProvider: prefs.ttsProvider,
          micEnabled: prefs.micEnabled,
          theme: prefs.theme,
          autoSubmit: prefs.autoSubmit,
          showWelcomeScreen: true,
          dontShowWelcomeAgain: false,
        });
      } catch (err) {
        console.warn(
          "[useUserPreferences] Failed to persist preferences to IndexedDB",
          err,
        );
      }
    },
    [effectiveUid],
  );

  /**
   * Update a single preference field and sync with downstream systems.
   */
  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => {
        const next = { ...prev, [key]: value };

        // Side effects based on the key being updated
        switch (key) {
          case "soundEnabled": {
            const enabled = value as boolean;
            soundManager.setEnabled?.(enabled);
            audioManager.setMuted(!enabled);
            setStoreMuted(!enabled);
            break;
          }
          case "soundVolume": {
            // Volume is read by SoundManager.play() callers;
            // stored here for SettingsPanel slider binding.
            break;
          }
          case "ttsProvider": {
            const provider = value as TtsProvider;
            audioManager.setVoiceQuality(
              provider === "gemini" ? "natural" : "standard",
            );
            setStoreVoiceQuality(
              provider === "gemini" ? "natural" : "standard",
            );
            break;
          }
          case "micEnabled": {
            // Mic enablement is consumed by voice input components;
            // stored here for SettingsPanel toggle binding.
            break;
          }
          case "difficulty": {
            setStoreDifficulty(value as GameDifficulty);
            config?.onDifficultyChange?.(value as GameDifficulty);
            break;
          }
          case "grade": {
            // Map GradeLevel string to numeric grade for the store
            const gradeStr = value as GradeLevel;
            const gradeMap: Record<GradeLevel, number> = {
              "K-2": 1,
              "3-5": 3,
              "6-8": 6,
              "9-12": 9,
              all: 0,
            };
            setStoreGradeLevel(gradeMap[gradeStr] ?? 1);
            config?.onGradeLevelChange?.(gradeStr);
            break;
          }
          case "autoSubmit": {
            setStoreAutoSubmit(value as boolean);
            break;
          }
          case "theme": {
            // Theme switching reserved for future implementation
            break;
          }
        }

        // Persist asynchronously
        void persistToStorage(next);
        return next;
      });
    },
    [
      persistToStorage,
      setStoreDifficulty,
      setStoreGradeLevel,
      setStoreMuted,
      setStoreAutoSubmit,
      setStoreVoiceQuality,
      config,
    ],
  );

  /**
   * Reset all preferences to DEFAULT_PREFERENCES.
   */
  const resetPreferences = useCallback(() => {
    setPreferences({ ...DEFAULT_PREFERENCES });
    void persistToStorage(DEFAULT_PREFERENCES);

    // Apply reset values to downstream systems
    soundManager.setEnabled?.(DEFAULT_PREFERENCES.soundEnabled);
    audioManager.setMuted(!DEFAULT_PREFERENCES.soundEnabled);
    audioManager.setVoiceQuality(
      DEFAULT_PREFERENCES.ttsProvider === "gemini" ? "natural" : "standard",
    );
    setStoreMuted(!DEFAULT_PREFERENCES.soundEnabled);
    setStoreDifficulty(DEFAULT_PREFERENCES.difficulty);
    setStoreGradeLevel(0); // 'all' maps to grade 0
    setStoreAutoSubmit(DEFAULT_PREFERENCES.autoSubmit);
    setStoreVoiceQuality(
      DEFAULT_PREFERENCES.ttsProvider === "gemini" ? "natural" : "standard",
    );
  }, [
    persistToStorage,
    setStoreMuted,
    setStoreDifficulty,
    setStoreGradeLevel,
    setStoreAutoSubmit,
    setStoreVoiceQuality,
  ]);

  return {
    preferences,
    updatePreference,
    resetPreferences,
    isLoading,
  };
}

// Re-export types for convenience
export type {
  UserPreferences,
  UseUserPreferencesConfig,
  UseUserPreferencesReturn,
  TtsProvider,
  GradeLevel,
} from "./useUserPreferences.types";
