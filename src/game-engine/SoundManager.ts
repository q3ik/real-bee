export const SOUND_FREQUENCIES: Record<string, number[]> = {
  correct: [523.25, 659.25, 783.99],
  incorrect: [329.63, 261.63, 196],
  streak: [523.25, 659.25, 783.99, 1046.5],
};

const MAX_CACHE_SIZE = 50;

export interface PlayAudioBufferOptions {
  cacheKey?: string;
  volume?: number;
  onEnded?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Manages audio playback with caching, effects, and resource cleanup.
 *
 * - Oscillator-based sound effects (correct, incorrect, streak)
 * - AudioBuffer caching with LRU eviction
 * - Async preloading for TTS audio
 * - Track and stop all active audio sources
 */
export class SoundManager {
  private context: AudioContext | null = null;
  public isSupported: boolean;
  private audioCache: Map<string, AudioBuffer> = new Map();
  private cacheKeys: string[] = [];
  private activeSources: AudioBufferSourceNode[] = [];

  constructor() {
    this.isSupported =
      typeof window !== 'undefined' &&
      ('AudioContext' in window || 'webkitAudioContext' in window);
  }

  /**
   * Get or create the AudioContext singleton.
   * Automatically resumes if suspended.
   * Throws a clear error when AudioContext is unavailable (SSR / unsupported browsers).
   */
  getContext(): AudioContext {
    if (!this.isSupported) {
      throw new Error('AudioContext not supported');
    }
    if (!this.context) {
      const AC = (window as any).AudioContext ?? (window as any).webkitAudioContext;
      this.context = new AC() as AudioContext;
    }
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
    return this.context;
  }

  /**
   * Play an oscillator-based sound effect.
   *
   * @param kind - Sound effect name (e.g., 'correct', 'incorrect', 'streak')
   * @param volume - Volume level (0-1, default 0.2)
   */
  play(kind: string, volume: number = 0.2): void {
    if (!this.isSupported) return;

    const context = this.getContext();
    const frequencies = SOUND_FREQUENCIES[kind];
    if (!frequencies) return;

    // Clamp to a strictly positive value so exponentialRampToValueAtTime never
    // throws when callers legitimately pass volume=0 to mute.
    const effectiveVolume = Math.max(volume, 0.001);

    frequencies.forEach((freq, i) => {
      const osc = context.createOscillator();
      const gain = context.createGain();

      if (kind === 'incorrect') {
        osc.type = 'sawtooth';
      }

      osc.frequency.setValueAtTime(freq, context.currentTime + i * 0.1);
      gain.gain.setValueAtTime(effectiveVolume, context.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + i * 0.1 + 0.3);

      osc.connect(gain);
      gain.connect(context.destination);

      osc.start(context.currentTime + i * 0.1);
      osc.stop(context.currentTime + i * 0.1 + 0.3);
    });
  }

  /**
   * Decode and play audio data (ArrayBuffer or Blob).
   * Caches the decoded AudioBuffer if a cacheKey is provided.
   */
  async playAudioBuffer(
    audioData: ArrayBuffer | Blob | null,
    options: PlayAudioBufferOptions = {},
  ): Promise<void> {
    if (!this.isSupported) {
      throw new Error('AudioContext not supported');
    }

    const context = this.getContext();
    const { cacheKey, volume = 1.0, onEnded, onError } = options;

    let audioBuffer: AudioBuffer;

    if (cacheKey && this.audioCache.has(cacheKey)) {
      // Cache hit — refresh LRU position
      audioBuffer = this.audioCache.get(cacheKey)!;
      this.cacheAudio(cacheKey, audioBuffer);
    } else {
      try {
        let arrayBuffer: ArrayBuffer;
        if (audioData instanceof ArrayBuffer) {
          arrayBuffer = audioData;
        } else if (audioData && typeof (audioData as Blob).arrayBuffer === 'function') {
          arrayBuffer = await (audioData as Blob).arrayBuffer();
        } else {
          throw new Error('Invalid audio data');
        }

        audioBuffer = await context.decodeAudioData(arrayBuffer);

        if (cacheKey) {
          this.cacheAudio(cacheKey, audioBuffer);
        }
      } catch (error) {
        if (onError) onError(error as Error);
        throw error;
      }
    }

    const source = context.createBufferSource();
    source.buffer = audioBuffer;

    const gainNode = context.createGain();
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(context.destination);

    this.activeSources.push(source);

    source.onended = () => {
      const index = this.activeSources.indexOf(source);
      if (index !== -1) this.activeSources.splice(index, 1);
      source.disconnect();
      if (onEnded) onEnded();
    };

    source.start();
  }

  /**
   * Cache an AudioBuffer with LRU eviction.
   */
  private cacheAudio(key: string, buffer: AudioBuffer): void {
    const existingIndex = this.cacheKeys.indexOf(key);
    if (existingIndex !== -1) {
      this.cacheKeys.splice(existingIndex, 1);
    }

    if (!this.audioCache.has(key) && this.cacheKeys.length >= MAX_CACHE_SIZE) {
      const oldest = this.cacheKeys.shift()!;
      this.audioCache.delete(oldest);
    }

    this.audioCache.set(key, buffer);
    this.cacheKeys.push(key);
  }

  /**
   * Check if an audio buffer is cached.
   */
  isCached(key: string): boolean {
    return this.audioCache.has(key);
  }

  /**
   * Get cache statistics for debugging.
   */
  getCacheStats(): { size: number; maxSize: number; keys: string[] } {
    return {
      size: this.audioCache.size,
      maxSize: MAX_CACHE_SIZE,
      keys: [...this.cacheKeys],
    };
  }

  /**
   * Clear the entire audio cache.
   */
  clearCache(): void {
    this.audioCache.clear();
    this.cacheKeys = [];
  }

  /**
   * Preload and cache audio data without playing.
   * No-ops when AudioContext is not supported (SSR / unsupported browsers).
   */
  async preloadAudio(audioData: ArrayBuffer | Blob | null, cacheKey: string): Promise<void> {
    if (!this.isSupported) {
      throw new Error('AudioContext not supported');
    }

    if (!cacheKey) {
      throw new Error('cacheKey required');
    }

    if (this.isCached(cacheKey)) {
      return;
    }

    const context = this.getContext();

    let arrayBuffer: ArrayBuffer;
    if (audioData instanceof ArrayBuffer) {
      arrayBuffer = audioData;
    } else if (audioData && typeof (audioData as Blob).arrayBuffer === 'function') {
      arrayBuffer = await (audioData as Blob).arrayBuffer();
    } else {
      throw new Error('Invalid audio data');
    }

    const audioBuffer = await context.decodeAudioData(arrayBuffer);
    this.cacheAudio(cacheKey, audioBuffer);
  }

  /** Returns the number of currently playing audio sources. */
  getActiveSourceCount(): number {
    return this.activeSources.length;
  }

  /** Returns whether an AudioContext has been created. */
  isContextInitialized(): boolean {
    return this.context !== null;
  }

  /**
   * Resets all internal state back to initial values.
   * Only intended for use in unit tests.
   */
  resetForTesting(): void {
    this.context = null;
    this.audioCache = new Map();
    this.cacheKeys = [];
    this.activeSources = [];
  }

  /**
   * Stop all currently playing audio sources.
   */
  stopAll(): void {
    const sources = [...this.activeSources];
    this.activeSources = [];

    sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Source might already be stopped
      }
    });
  }

  /**
   * Clean up all resources.
   */
  cleanup(): void {
    this.stopAll();
    this.clearCache();
    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }
}

export const soundManager = new SoundManager();
