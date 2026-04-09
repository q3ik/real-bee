import { Sentry } from "./sentry";

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

      this.audioContext = new AudioContextClass({
        latencyHint: "interactive",
        sampleRate: 44100,
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
