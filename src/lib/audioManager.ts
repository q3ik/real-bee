class AudioManager {
  private audioContext: AudioContext | null = null;
  private isMuted: boolean = false;
  private voiceQuality: 'natural' | 'standard' = 'natural';

  constructor() {
    // Lazy init audio context on first user interaction
  }

  private initAudioContext(): boolean {
    if (!this.audioContext) {
      const AudioContextConstructor =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextConstructor) return false;
      try {
        this.audioContext = new AudioContextConstructor();
      } catch {
        return false;
      }
    }
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return true;
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  setVoiceQuality(quality: 'natural' | 'standard') {
    this.voiceQuality = quality;
  }

  async speak(text: string): Promise<void> {
    if (this.isMuted) return Promise.resolve();
    const hasAudioContext = this.initAudioContext();

    if (this.voiceQuality === 'natural' && hasAudioContext) {
      try {
        await this.speakViaWorker(text);
        return;
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        // Handle quota errors or general TTS failures by falling back
        if (
          errorMsg.includes('429') ||
          errorMsg.includes('RESOURCE_EXHAUSTED') ||
          errorMsg.includes('quota') ||
          errorMsg.includes('exceeded quota')
        ) {
          // Silent fallback for quota issues
        } else {
          console.error("Gemini TTS failed, falling back to Web Speech:", error);
        }
      }
    }

    try {
      await this.speakWebSpeech(text);
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      throw new Error(`Web Speech synthesis failed: ${errorMessage}`);
    }
  }

  private async speakViaWorker(text: string): Promise<void> {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'tts', word: text }),
    });

    if (!response.ok) {
      throw new Error(`TTS worker responded with ${response.status}`);
    }

    const { audio: base64Audio, mimeType, sampleRate = 24000 } =
      await response.json() as { audio: string; mimeType: string; sampleRate?: number };

    if (mimeType !== 'audio/pcm') {
      throw new Error(`Unexpected TTS audio format: ${mimeType}`);
    }

    if (base64Audio) {
      const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
      const int16Buffer = new Int16Array(audioData.buffer);
      const float32Buffer = new Float32Array(int16Buffer.length);
      for (let i = 0; i < int16Buffer.length; i++) {
        float32Buffer[i] = int16Buffer[i] / 32768;
      }

      const audioBuffer = this.audioContext!.createBuffer(1, float32Buffer.length, sampleRate);
      audioBuffer.getChannelData(0).set(float32Buffer);

      return new Promise((resolve) => {
        const source = this.audioContext!.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext!.destination);
        source.onended = () => resolve();
        source.start();
      });
    }
  }

  private speakWebSpeech(text: string): Promise<void> {
    return new Promise((resolve) => {
      const hasWindow = typeof window !== 'undefined';
      const missingSpeechSynthesis =
        !hasWindow || typeof window.speechSynthesis === 'undefined';
      const missingUtterance =
        !hasWindow || typeof (window as any).SpeechSynthesisUtterance === 'undefined';
      if (missingSpeechSynthesis || missingUtterance) {
        const details = missingSpeechSynthesis && missingUtterance
          ? 'speechSynthesis and SpeechSynthesisUtterance are unavailable.'
          : missingSpeechSynthesis
            ? 'speechSynthesis is unavailable.'
            : 'SpeechSynthesisUtterance is unavailable.';
        throw new Error(`Speech synthesis not supported: ${details}`);
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8; // Slightly slower for clarity
      utterance.onend = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }

  playEffect(type: 'correct' | 'incorrect' | 'click') {
    if (this.isMuted) return;
    if (!this.initAudioContext()) return;
    // Simple oscillator-based sounds for offline support
    const osc = this.audioContext!.createOscillator();
    const gain = this.audioContext!.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext!.destination);

    if (type === 'correct') {
      osc.frequency.setValueAtTime(523.25, this.audioContext!.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.50, this.audioContext!.currentTime + 0.1); // C6
      gain.gain.setValueAtTime(0.1, this.audioContext!.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + 0.3);
      osc.start();
      osc.stop(this.audioContext!.currentTime + 0.3);
    } else if (type === 'incorrect') {
      osc.frequency.setValueAtTime(220, this.audioContext!.currentTime); // A3
      osc.frequency.exponentialRampToValueAtTime(110, this.audioContext!.currentTime + 0.2); // A2
      gain.gain.setValueAtTime(0.1, this.audioContext!.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + 0.4);
      osc.start();
      osc.stop(this.audioContext!.currentTime + 0.4);
    }
  }
}

export const audioManager = new AudioManager();
