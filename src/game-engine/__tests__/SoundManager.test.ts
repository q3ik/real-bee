import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Override the global mock from setup.tsx for this test file
vi.mock("@/game-engine/SoundManager", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../SoundManager")>();
  return {
    ...actual,
    soundManager: actual.soundManager,
  };
});

import { SoundManager } from "../SoundManager";

describe("SoundManager", () => {
  let manager: SoundManager;

  beforeEach(() => {
    manager = new SoundManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("setEnabled / isEnabled", () => {
    it("defaults to enabled", () => {
      expect(manager.isEnabled()).toBe(true);
    });

    it("setEnabled(false) disables playback", () => {
      manager.setEnabled(false);
      expect(manager.isEnabled()).toBe(false);
    });

    it("setEnabled(true) re-enables playback", () => {
      manager.setEnabled(false);
      manager.setEnabled(true);
      expect(manager.isEnabled()).toBe(true);
    });

    it("setEnabled(false) calls stopAll() to halt in-flight audio", () => {
      const stopAllSpy = vi.spyOn(manager, "stopAll");
      manager.setEnabled(false);
      expect(stopAllSpy).toHaveBeenCalled();
    });
  });

  describe("play()", () => {
    it("is a no-op when disabled", () => {
      manager.setEnabled(false);
      // Should not throw even without AudioContext
      manager.play("correct");
    });
  });

  describe("playAudioBuffer()", () => {
    it("throws when disabled", async () => {
      manager.setEnabled(false);
      await expect(manager.playAudioBuffer(null)).rejects.toThrow(
        "AudioContext not supported",
      );
    });
  });

  describe("preloadAudio()", () => {
    it("returns early when disabled", async () => {
      manager.setEnabled(false);
      // Should resolve without throwing (no-op)
      await expect(
        manager.preloadAudio(null, "test-key"),
      ).resolves.toBeUndefined();
    });
  });
});
