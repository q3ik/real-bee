import { describe, it, expect } from "vitest";
import {
  STREAK_MILESTONES,
  POINTS_PER_STREAK,
  RECENT_PERFORMANCE_WINDOW,
  FEEDBACK_DELAY_MS,
  ROUND_DURATION_MS,
  VOICE_TIMEOUT_MS,
  MAX_HINTS_PER_WORD,
  VISIBLE_MESSAGE_COUNT,
  CONFETTI_CONFIG,
} from "../game";
import {
  SILENCE_TIMEOUT_MS,
  MAX_LISTEN_MS,
  TRANSCRIPT_GRACE_PERIOD_MS,
  NATO_ALPHABET,
  WHOLE_WORD_MIN_LENGTH,
  PARTIAL_SPELL_THRESHOLD,
} from "../voice";
import {
  SOUND_EFFECT_CORRECT,
  SOUND_EFFECT_INCORRECT,
  TTS_SAMPLE_RATE,
  WEB_SPEECH_RATE,
} from "../audio";
import {
  PREFERENCE_DEFAULTS,
  GRADE_OPTIONS,
  DIFFICULTY_OPTIONS,
} from "../preferences";

describe("Constants", () => {
  describe("Game constants", () => {
    it("STREAK_MILESTONES contains expected values", () => {
      expect(STREAK_MILESTONES).toEqual([5, 10, 15, 20]);
    });

    it("POINTS_PER_STREAK is 10", () => {
      expect(POINTS_PER_STREAK).toBe(10);
    });

    it("RECENT_PERFORMANCE_WINDOW is 10", () => {
      expect(RECENT_PERFORMANCE_WINDOW).toBe(10);
    });

    it("VOICE_TIMEOUT_MS has correct values for all options", () => {
      expect(VOICE_TIMEOUT_MS.normal).toBe(10_000);
      expect(VOICE_TIMEOUT_MS.longer).toBe(15_000);
      expect(VOICE_TIMEOUT_MS.off).toBe(60_000);
    });

    it("CONFETTI_CONFIG has required properties", () => {
      expect(CONFETTI_CONFIG.particleCount).toBe(40);
      expect(CONFETTI_CONFIG.disableForReducedMotion).toBe(true);
    });
  });

  describe("Voice constants", () => {
    it("NATO_ALPHABET has 26 entries", () => {
      expect(Object.keys(NATO_ALPHABET)).toHaveLength(26);
    });

    it("NATO_ALPHABET maps alpha to a", () => {
      expect(NATO_ALPHABET.alpha).toBe("a");
    });

    it("SILENCE_TIMEOUT_MS is 3000", () => {
      expect(SILENCE_TIMEOUT_MS).toBe(3000);
    });

    it("MAX_LISTEN_MS is 15000", () => {
      expect(MAX_LISTEN_MS).toBe(15000);
    });

    it("PARTIAL_SPELL_THRESHOLD is 0.5", () => {
      expect(PARTIAL_SPELL_THRESHOLD).toBe(0.5);
    });
  });

  describe("Audio constants", () => {
    it("SOUND_EFFECT_CORRECT is C5 to C6", () => {
      expect(SOUND_EFFECT_CORRECT.startFrequency).toBe(523.25);
      expect(SOUND_EFFECT_CORRECT.endFrequency).toBe(1046.5);
    });

    it("SOUND_EFFECT_INCORRECT is A3 to A2", () => {
      expect(SOUND_EFFECT_INCORRECT.startFrequency).toBe(220);
      expect(SOUND_EFFECT_INCORRECT.endFrequency).toBe(110);
    });

    it("TTS_SAMPLE_RATE is 24000", () => {
      expect(TTS_SAMPLE_RATE).toBe(24000);
    });

    it("WEB_SPEECH_RATE is 0.8", () => {
      expect(WEB_SPEECH_RATE).toBe(0.8);
    });
  });

  describe("Preference constants", () => {
    it("GRADE_OPTIONS has 4 entries", () => {
      expect(GRADE_OPTIONS).toHaveLength(4);
    });

    it("DIFFICULTY_OPTIONS has 4 entries", () => {
      expect(DIFFICULTY_OPTIONS).toHaveLength(4);
    });

    it("PREFERENCE_DEFAULTS has correct defaults", () => {
      expect(PREFERENCE_DEFAULTS.soundEnabled).toBe(true);
      expect(PREFERENCE_DEFAULTS.autoSubmit).toBe(false);
    });
  });

  describe("Cross-constant consistency", () => {
    it("ROUND_DURATION_MS is longer than MAX_LISTEN_MS", () => {
      expect(ROUND_DURATION_MS).toBeGreaterThan(MAX_LISTEN_MS);
    });

    it("SILENCE_TIMEOUT_MS is shorter than MAX_LISTEN_MS", () => {
      expect(SILENCE_TIMEOUT_MS).toBeLessThan(MAX_LISTEN_MS);
    });

    it("FEEDBACK_DELAY_MS is reasonable for UX", () => {
      expect(FEEDBACK_DELAY_MS).toBeLessThanOrEqual(3000);
    });
  });
});
