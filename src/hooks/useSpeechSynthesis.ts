import { useCallback, useEffect, useRef, useState } from 'react';
import { audioManager } from '../lib/audioManager';
import type { SpeechSynthesisConfig, SpeechSynthesisResult } from './useSpeechSynthesis.types';

/**
 * Detect whether AudioContext (required by audioManager) is available.
 * Returns false in SSR / environments without Web Audio support.
 */
function isTTSSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const hasAudioContext =
    typeof (window.AudioContext ?? (window as any).webkitAudioContext) !== 'undefined';
  const hasSpeechSynthesis =
    typeof window.speechSynthesis !== 'undefined' &&
    typeof (window as any).SpeechSynthesisUtterance !== 'undefined';
  return hasAudioContext || hasSpeechSynthesis;
}

/**
 * Hook that provides speech synthesis (TTS) by wrapping the `audioManager`
 * singleton (Gemini TTS via Worker → Web Speech API fallback).
 *
 * Provides game-specific helper methods (`repeatWord`, `giveDefinition`, etc.)
 * and a `soundEnabled` guard so callers don't have to check mute state themselves.
 */
export function useSpeechSynthesis({
  addMessage,
  soundEnabled = true,
  onError,
}: SpeechSynthesisConfig): SpeechSynthesisResult {
  const isMountedRef = useRef(false);
  // currentPlaybackRef tracks the active playback token so that a callback
  // scheduled by an older speak() call is not invoked after a newer one starts
  // or after the component unmounts.
  const currentPlaybackRef = useRef<symbol | null>(null);
  const [ttsSupported] = useState(isTTSSupported());

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

      if (!ttsSupported) {
        onError?.('Text-to-speech is unavailable right now.');
        callback?.();
        return;
      }

      const playbackId = Symbol('playback');
      currentPlaybackRef.current = playbackId;

      try {
        await audioManager.speak(text);
      } catch (error: unknown) {
        if (!isMountedRef.current) return;
        // audioManager falls back to Web Speech internally;
        // reaching here means both paths failed.
        onError?.('Text-to-speech is unavailable right now.');
      }

      // Only invoke the callback if this is still the active playback token
      // and the component is still mounted.
      if (isMountedRef.current && currentPlaybackRef.current === playbackId) {
        callback?.();
      }
    },
    [soundEnabled, onError, ttsSupported],
  );

  const repeatWord = useCallback(
    async (word: string) => {
      const shouldHideWord = soundEnabled && ttsSupported;
      addMessage('word', shouldHideWord ? 'Repeating: [hidden]' : `Repeating: ${word}`);
      await speak(`Your word is: ${word}`);
    },
    [addMessage, speak, soundEnabled, ttsSupported],
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
