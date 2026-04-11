import {
  SOUND_EFFECT_CORRECT,
  SOUND_EFFECT_INCORRECT,
  TTS_SAMPLE_RATE,
  WEB_SPEECH_RATE,
  WEB_SPEECH_PITCH,
  WEB_SPEECH_VOLUME,
  type SoundEffectType,
} from "../constants/audio";
import { audioSessionManager } from "./audioSessionManager";

/**
 * Audio playback manager for TTS and sound effects.
 *
 * Delegates AudioContext lifecycle (init, resume, cleanup) to
 * `audioSessionManager`. Handles TTS (Gemini Worker → Web Speech fallback)
 * and oscillator-based sound effects.
 */
class AudioManager {
  private isMuted: boolean = false;
  private voiceQuality: "natural" | "standard" = "natural";

  constructor() {
    // AudioContext lifecycle is managed by audioSessionManager
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  setVoiceQuality(quality: "natural" | "standard") {
    this.voiceQuality = quality;
  }

  async speak(text: string): Promise<void> {
    if (this.isMuted) return Promise.resolve();
    const sessionResult = await audioSessionManager.ensureActive();
    const hasAudioContext = sessionResult.success;

    if (this.voiceQuality === "natural" && hasAudioContext) {
      try {
        await this.speakViaWorker(text);
        return;
      } catch (error: unknown) {
        const errorMsg = (error as Error)?.message ?? String(error);
        // Quota errors and network errors (offline, DNS, worker not running)
        // are expected conditions — silently fall back to Web Speech without
        // console noise.  Only truly unexpected errors (e.g. audio decode
        // failures) should be logged.
        if (
          errorMsg.includes("429") ||
          errorMsg.includes("RESOURCE_EXHAUSTED") ||
          errorMsg.includes("quota") ||
          errorMsg.includes("exceeded quota") ||
          errorMsg.includes("Failed to fetch") ||
          errorMsg.includes("NetworkError") ||
          errorMsg.includes("network") ||
          errorMsg.includes("abort")
        ) {
          // Silent fallback for quota and network issues
        } else {
          console.error(
            "Gemini TTS failed, falling back to Web Speech:",
            error,
          );
        }
      }
    }

    try {
      await this.speakWebSpeech(text);
    } catch (error: unknown) {
      const errorMessage = (error as Error)?.message ?? String(error);
      throw new Error(`Web Speech synthesis failed: ${errorMessage}`);
    }
  }

  private async speakViaWorker(text: string): Promise<void> {
    const ctx = audioSessionManager.getContext();
    if (!ctx) throw new Error("AudioContext not available");

    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "tts", word: text }),
    });

    if (!response.ok) {
      throw new Error(`TTS worker responded with ${response.status}`);
    }

    const {
      audio: base64Audio,
      mimeType,
      sampleRate = TTS_SAMPLE_RATE,
    } = (await response.json()) as {
      audio: string;
      mimeType: string;
      sampleRate?: number;
    };

    if (mimeType !== "audio/pcm") {
      throw new Error(`Unexpected TTS audio format: ${mimeType}`);
    }

    if (base64Audio) {
      const audioData = Uint8Array.from(atob(base64Audio), (c) =>
        c.charCodeAt(0),
      );
      const int16Buffer = new Int16Array(audioData.buffer);
      const float32Buffer = new Float32Array(int16Buffer.length);
      for (let i = 0; i < int16Buffer.length; i++) {
        float32Buffer[i] = int16Buffer[i] / 32768;
      }

      const audioBuffer = ctx.createBuffer(1, float32Buffer.length, sampleRate);
      audioBuffer.getChannelData(0).set(float32Buffer);

      return new Promise((resolve) => {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => resolve();
        source.start();
      });
    }
  }

  private speakWebSpeech(text: string): Promise<void> {
    return new Promise((resolve) => {
      const hasWindow = typeof window !== "undefined";
      const missingSpeechSynthesis =
        !hasWindow || typeof window.speechSynthesis === "undefined";
      const missingUtterance =
        !hasWindow ||
        typeof (window as any).SpeechSynthesisUtterance === "undefined";
      if (missingSpeechSynthesis || missingUtterance) {
        const details =
          missingSpeechSynthesis && missingUtterance
            ? "speechSynthesis and SpeechSynthesisUtterance are unavailable."
            : missingSpeechSynthesis
              ? "speechSynthesis is unavailable."
              : "SpeechSynthesisUtterance is unavailable.";
        throw new Error(`Speech synthesis not supported: ${details}`);
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = WEB_SPEECH_RATE;
      utterance.pitch = WEB_SPEECH_PITCH;
      utterance.volume = WEB_SPEECH_VOLUME;
      utterance.onend = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }

  playEffect(type: SoundEffectType): void {
    if (this.isMuted) return;
    const ctx = audioSessionManager.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const config =
      type === "correct"
        ? SOUND_EFFECT_CORRECT
        : type === "incorrect"
          ? SOUND_EFFECT_INCORRECT
          : null;

    if (!config) return;

    osc.frequency.setValueAtTime(config.startFrequency, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      config.endFrequency,
      ctx.currentTime + config.duration * 0.33,
    );
    gain.gain.setValueAtTime(config.startGain, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      config.endGain,
      ctx.currentTime + config.duration,
    );
    osc.start();
    osc.stop(ctx.currentTime + config.duration);
  }
}

export const audioManager = new AudioManager();
