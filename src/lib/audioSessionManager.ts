import { Sentry } from "./sentry";
import { TTS_SAMPLE_RATE } from "../constants/audio";

/**
 * Result of an audio session operation.
 */
export interface AudioSessionResult {
  success: boolean;
  error?: string;
}

/**
 * Manages the lifecycle of the browser AudioContext.
 *
 * Provides initialization, resume-from-suspended, and cleanup operations
 * with Sentry error reporting and leak detection.
 */
class AudioSessionManager {
  private audioContext: AudioContext | null = null;
  private initialized = false;
  private routingState: "speaker" | "unknown" = "unknown";

  /**
   * Initialize the AudioContext with low-latency settings.
   * Idempotent — safe to call multiple times.
   *
   * NOTE: sampleRate is intentionally not set so the browser uses its
   * hardware default. The Gemini TTS worker returns 24 kHz PCM
   * (TTS_SAMPLE_RATE); the context resamples each AudioBuffer independently
   * via AudioBuffer.sampleRate — locking the context to 44100 Hz caused
   * TTS audio to play at the wrong speed.
   */
  async initialize(): Promise<AudioSessionResult> {
    if (this.initialized) return { success: true };

    try {
      const AudioContextClass = (window.AudioContext ||
        (window as any).webkitAudioContext) as typeof AudioContext;
      if (!AudioContextClass)
        return { success: false, error: "AudioContext not supported" };

      // Detect a leaked context: uninitialized flag but a live context object exists
      if (this.audioContext && this.audioContext.state !== "closed") {
        Sentry.captureMessage(
          "AudioContext leak detected: context exists but initialized=false",
          {
            level: "warning",
            tags: { "audio.context.state": this.audioContext.state },
          },
        );
        try {
          await this.audioContext.close();
        } catch {
          /* best-effort */
        }
        this.audioContext = null;
      }

      // Do not set sampleRate — let the browser use its hardware default.
      // Each AudioBuffer carries its own sampleRate for correct resampling.
      this.audioContext = new AudioContextClass({
        latencyHint: "interactive",
      });

      if (this.audioContext.state === "suspended") {
        const resumeTimeout = new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new Error("AudioContext resume timeout")),
            5000,
          ),
        );
        await Promise.race([this.audioContext.resume(), resumeTimeout]);
      }

      this.initialized = true;
      this.routingState = "speaker";
      return { success: true };
    } catch (error) {
      // Null out the context so ensureActive() re-enters initialize() rather
      // than attempting to resume a broken/timed-out context indefinitely.
      this.audioContext = null;
      this.initialized = false;
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[AudioSession] Init failed:", error);
      Sentry.captureException(error, {
        level: "error",
        tags: { "audio.error": "init_failed" },
        extra: { message: `AudioContext init failed: ${message}` },
      });
      return { success: false, error: message };
    }
  }

  /**
   * Ensure the AudioContext is active and ready for playback.
   * Initializes on first call; resumes if suspended.
   */
  async ensureActive(): Promise<AudioSessionResult> {
    if (!this.audioContext) return this.initialize();
    if (this.audioContext.state === "suspended") {
      try {
        const resumeTimeout = new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new Error("AudioContext resume timeout")),
            5000,
          ),
        );
        await Promise.race([this.audioContext.resume(), resumeTimeout]);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to resume audio context";
        Sentry.captureMessage(`AudioContext resume failed: ${message}`, {
          level: "warning",
          tags: { "audio.error": "resume_failed" },
        });
        return { success: false, error: message };
      }
    }
    return { success: true };
  }

  /**
   * Get the current audio routing state.
   */
  getRoutingState(): "speaker" | "unknown" {
    return this.routingState;
  }

  /**
   * Get the active AudioContext (or null if not initialized).
   */
  getContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Whether the AudioContext has been successfully initialized.
   * Exposed so test mocks can stay in sync with the real interface.
   */
  getInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Close and clean up the AudioContext.
   * Safe to call even if never initialized.
   */
  async cleanup(): Promise<AudioSessionResult> {
    if (!this.audioContext) return { success: true };
    const context = this.audioContext;
    this.audioContext = null;
    this.initialized = false;
    this.routingState = "unknown";
    try {
      await context.close();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.warn("[AudioSessionManager] Failed to close AudioContext:", e);
      Sentry.captureMessage(`AudioContext close failed: ${message}`, {
        level: "warning",
        tags: { "audio.error": "close_failed" },
      });
    }
    return { success: true };
  }
}

export const audioSessionManager = new AudioSessionManager();

// Re-export TTS_SAMPLE_RATE so callers don't need a separate constants import
// when they need to create AudioBuffers at the correct rate.
export { TTS_SAMPLE_RATE };
