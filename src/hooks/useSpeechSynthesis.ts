import { useCallback, useEffect, useRef, useState } from 'react';
import { audioManager } from '../lib/audioManager';
import type { SpeechSynthesisConfig, SpeechSynthesisResult } from './useSpeechSynthesis.types';

/**
 * Detect whether the Gemini TTS backend is available.
 * We assume it is available if the browser supports fetch and we are not offline.
 */
function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && typeof fetch !== 'undefined';
}

/**
 * Detect browser Web Speech API availability.
 */
function isWebSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const synth = window.speechSynthesis;
    return !!synth && typeof synth.speak === 'function';
  } catch {
    return false;
  }
}

/**
 * Hook that provides speech synthesis (TTS) via the Gemini Worker proxy
 * with Web Speech API fallback.
 *
 * Wraps the `audioManager` singleton and provides game-specific helper methods.
 */
export function useSpeechSynthesis({
  addMessage,
  soundEnabled = true,
  onError,
}: SpeechSynthesisConfig): SpeechSynthesisResult {
  const isMountedRef = useRef(false);
  const currentPlaybackRef = useRef<symbol | null>(null);
  const [ttsSupported] = useState(isTTSSupported);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const speak = useCallback(
    async (text: string, callback?: () => void) => {
      if (!text || !soundEnabled) {
        callback?.();
        return;
      }

      const playbackId = Symbol('playback');
      currentPlaybackRef.current = playbackId;

      try {
        await audioManager.speak(text);
      } catch (error: unknown) {
        if (!isMountedRef.current) return;
        // audioManager already falls back to Web Speech internally,
        // so if we reach here both paths failed.
        onError?.('Text-to-speech is unavailable right now.');
      }

      if (isMountedRef.current) {
        callback?.();
      }
    },
    [soundEnabled, onError],
  );

  const repeatWord = useCallback(
    async (word: string) => {
      const repeatText = ttsSupported ? 'Repeating: [hidden]' : `Repeating: ${word}`;
      addMessage('word', repeatText);
      await speak(`Your word is: ${word}`);
    },
    [addMessage, speak, ttsSupported],
  );

  const giveSentence = useCallback(
    async (sentence: string) => {
      addMessage('sentence', sentence);
      await speak(sentence);
    },
    [addMessage, speak],
  );

  const giveDefinition = useCallback(
    async (definition: string) => {
      addMessage('definition', `The definition is: ${definition}`);
      await speak(definition);
    },
    [addMessage, speak],
  );

  const giveHint = useCallback(
    async (hintText: string) => {
      addMessage('system', hintText);
      await speak(hintText);
    },
    [addMessage, speak],
  );

  return {
    speak,
    ttsSupported,
    repeatWord,
    giveSentence,
    giveDefinition,
    giveHint,
  };
}

// Re-export types for convenience
export type {
  SpeechSynthesisConfig,
  SpeechSynthesisResult,
  TranscriptMessageType,
  AddMessageCallback,
  BrowserSpeechCompatibility,
  SpeechSynthesisActions,
} from './useSpeechSynthesis.types';
