/**
 * Audio and sound effect constants.
 * Extracted from audioManager.ts.
 */

// ---------------------------------------------------------------------------
// Sound Effect Frequencies (Web Audio API oscillators)
// ---------------------------------------------------------------------------

/**
 * Correct answer sound: rising C5 → C6
 */
export const SOUND_EFFECT_CORRECT = {
  startFrequency: 523.25,  // C5
  endFrequency: 1046.50,   // C6
  duration: 0.3,
  startGain: 0.1,
  endGain: 0.01,
} as const;

/**
 * Incorrect answer sound: falling A3 → A2
 */
export const SOUND_EFFECT_INCORRECT = {
  startFrequency: 220,     // A3
  endFrequency: 110,       // A2
  duration: 0.4,
  startGain: 0.1,
  endGain: 0.01,
} as const;

// ---------------------------------------------------------------------------
// TTS Configuration
// ---------------------------------------------------------------------------

/**
 * Default sample rate for TTS audio from the Gemini Worker.
 */
export const TTS_SAMPLE_RATE = 24000;

/**
 * Web Speech API speech rate (slower for clarity in spelling bee context).
 */
export const WEB_SPEECH_RATE = 0.8;

/**
 * Web Speech API speech pitch (default).
 */
export const WEB_SPEECH_PITCH = 1.0;

/**
 * Web Speech API speech volume (full).
 */
export const WEB_SPEECH_VOLUME = 1.0;

// ---------------------------------------------------------------------------
// Sound effect type
// ---------------------------------------------------------------------------

export type SoundEffectType = 'correct' | 'incorrect' | 'click';
