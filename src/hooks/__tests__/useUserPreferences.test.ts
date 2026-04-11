import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUserPreferences } from "../useUserPreferences";
import { DEFAULT_PREFERENCES } from "../../constants/preferences";
import * as storageModule from "../../game-engine/storage";
import { soundManager } from "../../game-engine/SoundManager";
import { audioManager } from "../../lib/audioManager";
import { useGameStore } from "../useGameStore";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../game-engine/storage", () => ({
  saveUserPreferences: vi.fn().mockResolvedValue(undefined),
  loadUserPreferences: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../game-engine/SoundManager", () => ({
  soundManager: {
    setEnabled: vi.fn(),
    isEnabled: vi.fn().mockReturnValue(true),
    isSupported: true,
    play: vi.fn(),
  },
}));

vi.mock("../../lib/audioManager", () => ({
  audioManager: {
    setMuted: vi.fn(),
    setVoiceQuality: vi.fn(),
    speak: vi.fn(),
  },
}));

vi.mock("../useGameStore", () => ({
  useGameStore: vi.fn(),
}));

const mockSetDifficulty = vi.fn();
const mockSetGradeLevel = vi.fn();
const mockSetMuted = vi.fn();
const mockSetAutoSubmit = vi.fn();
const mockSetVoiceQuality = vi.fn();

function mockGameStoreSelector(selector: (state: Record<string, unknown>) => unknown) {
  const selectorStr = selector.toString();
  if (selectorStr.includes("setDifficulty")) return mockSetDifficulty;
  if (selectorStr.includes("setGradeLevel")) return mockSetGradeLevel;
  if (selectorStr.includes("setMuted")) return mockSetMuted;
  if (selectorStr.includes("setAutoSubmit")) return mockSetAutoSubmit;
  if (selectorStr.includes("setVoiceQuality")) return mockSetVoiceQuality;
  if (selectorStr.includes("userId")) return "test-user-123";
  return undefined;
}

vi.mocked(useGameStore).mockImplementation((selector: unknown) =>
  mockGameStoreSelector(selector as (state: Record<string, unknown>) => unknown),
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useUserPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storageModule.loadUserPreferences).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads default preferences when no stored data exists", async () => {
    const { result } = renderHook(() => useUserPreferences());

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for async load
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it("loads stored preferences from IndexedDB", async () => {
    vi.mocked(storageModule.loadUserPreferences).mockResolvedValue({
      uid: "test-user-123",
      difficulty: "hard",
      gradeLevel: "3-5",
      soundEnabled: false,
      soundVolume: 0.5,
      ttsProvider: "gemini",
      micEnabled: false,
      theme: "dark",
      autoSubmit: true,
      showWelcomeScreen: true,
      dontShowWelcomeAgain: false,
    });

    const { result } = renderHook(() => useUserPreferences());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.preferences.difficulty).toBe("hard");
    expect(result.current.preferences.grade).toBe("3-5");
    expect(result.current.preferences.soundEnabled).toBe(false);
    expect(result.current.preferences.soundVolume).toBe(0.5);
    expect(result.current.preferences.ttsProvider).toBe("gemini");
    expect(result.current.preferences.micEnabled).toBe(false);
    expect(result.current.preferences.theme).toBe("dark");
    expect(result.current.preferences.autoSubmit).toBe(true);
  });

  it("updatePreference persists to IndexedDB", async () => {
    const { result } = renderHook(() => useUserPreferences());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      result.current.updatePreference("soundEnabled", false);
    });

    expect(result.current.preferences.soundEnabled).toBe(false);
    expect(storageModule.saveUserPreferences).toHaveBeenCalled();
  });

  it("updatePreference('soundEnabled', false) calls soundManager.setEnabled(false)", async () => {
    const { result } = renderHook(() => useUserPreferences());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      result.current.updatePreference("soundEnabled", false);
    });

    expect(soundManager.setEnabled).toHaveBeenCalledWith(false);
    expect(audioManager.setMuted).toHaveBeenCalledWith(true);
    expect(mockSetMuted).toHaveBeenCalledWith(true);
  });

  it("updatePreference('soundEnabled', true) calls soundManager.setEnabled(true)", async () => {
    const { result } = renderHook(() => useUserPreferences());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      result.current.updatePreference("soundEnabled", true);
    });

    expect(soundManager.setEnabled).toHaveBeenCalledWith(true);
    expect(audioManager.setMuted).toHaveBeenCalledWith(false);
    expect(mockSetMuted).toHaveBeenCalledWith(false);
  });

  it("updatePreference('ttsProvider', 'gemini') updates voice quality", async () => {
    const { result } = renderHook(() => useUserPreferences());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      result.current.updatePreference("ttsProvider", "gemini");
    });

    expect(audioManager.setVoiceQuality).toHaveBeenCalledWith("natural");
    expect(mockSetVoiceQuality).toHaveBeenCalledWith("natural");
    expect(result.current.preferences.ttsProvider).toBe("gemini");
  });

  it("updatePreference('ttsProvider', 'web-speech') updates voice quality", async () => {
    const { result } = renderHook(() => useUserPreferences());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      result.current.updatePreference("ttsProvider", "web-speech");
    });

    expect(audioManager.setVoiceQuality).toHaveBeenCalledWith("standard");
    expect(mockSetVoiceQuality).toHaveBeenCalledWith("standard");
  });

  it("updatePreference('difficulty') calls store setter and callback", async () => {
    const onDifficultyChange = vi.fn();
    const { result } = renderHook(() => useUserPreferences({ onDifficultyChange }));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      result.current.updatePreference("difficulty", "easy");
    });

    expect(mockSetDifficulty).toHaveBeenCalledWith("easy");
    expect(onDifficultyChange).toHaveBeenCalledWith("easy");
  });

  it("updatePreference('grade') maps to numeric grade level", async () => {
    const onGradeLevelChange = vi.fn();
    const { result } = renderHook(() => useUserPreferences({ onGradeLevelChange }));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      result.current.updatePreference("grade", "6-8");
    });

    expect(mockSetGradeLevel).toHaveBeenCalledWith(6);
    expect(onGradeLevelChange).toHaveBeenCalledWith("6-8");
  });

  it("updatePreference('autoSubmit') calls store setter", async () => {
    const { result } = renderHook(() => useUserPreferences());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      result.current.updatePreference("autoSubmit", true);
    });

    expect(mockSetAutoSubmit).toHaveBeenCalledWith(true);
    expect(result.current.preferences.autoSubmit).toBe(true);
  });

  it("resetPreferences restores all values to DEFAULT_PREFERENCES", async () => {
    const { result } = renderHook(() => useUserPreferences());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Change some values
    await act(async () => {
      result.current.updatePreference("soundEnabled", false);
    });
    await act(async () => {
      result.current.updatePreference("difficulty", "hard");
    });

    expect(result.current.preferences.soundEnabled).toBe(false);
    expect(result.current.preferences.difficulty).toBe("hard");

    // Reset
    await act(async () => {
      result.current.resetPreferences();
    });

    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(soundManager.setEnabled).toHaveBeenCalledWith(true);
    expect(audioManager.setMuted).toHaveBeenCalledWith(false);
    expect(mockSetDifficulty).toHaveBeenCalledWith("all");
    expect(mockSetGradeLevel).toHaveBeenCalledWith(0);
    expect(mockSetAutoSubmit).toHaveBeenCalledWith(false);
  });

  it("exposes isLoading state", async () => {
    const { result } = renderHook(() => useUserPreferences());

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("updatePreference updates soundVolume", async () => {
    const { result } = renderHook(() => useUserPreferences());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      result.current.updatePreference("soundVolume", 0.5);
    });

    expect(result.current.preferences.soundVolume).toBe(0.5);
  });

  it("updatePreference updates micEnabled", async () => {
    const { result } = renderHook(() => useUserPreferences());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      result.current.updatePreference("micEnabled", false);
    });

    expect(result.current.preferences.micEnabled).toBe(false);
  });
});
