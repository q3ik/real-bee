import { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Constants (ported from buzzy-game constants/voiceInput, adapted for real-bee)
// ---------------------------------------------------------------------------

/** Timeout in ms before silence is detected and listening stops */
const SILENCE_TIMEOUT_MS = 3000;

/** Max listening duration in ms before auto-stop */
const MAX_LISTEN_MS = 15000;

/** Grace period after onend to collect final transcript fragments */
const TRANSCRIPT_GRACE_PERIOD_MS = 200;

/** Pattern for stripping completion cue words from transcript */
const COMPLETION_CUE_PATTERN = /\b(done|finished|that'?s it|that is it)\b/gi;

/** Pattern for detecting completion cues in transcript (used with .test()) */
const COMPLETION_CUE_DETECTION_PATTERN =
  /\b(done|finished|that'?s it|that is it)\b/i;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoiceRecognitionOptions {
  /** The target word being spelled (used for wake/stop detection and biasing) */
  targetWord?: string;
  /** Called with interim/final transcript fragments as they arrive */
  onTranscript?: (transcript: string) => void;
  /** Called with the final processed spelling result */
  onResult?: (result: string) => void;
  /** Called when an error occurs */
  onError?: (error: string) => void;
  /** Max listening duration in ms (default: MAX_LISTEN_MS = 15000) */
  timeout?: number;
}

export interface UseVoiceRecognitionResult {
  /** Whether the hook is currently listening */
  isListening: boolean;
  /** Whether the hook is processing audio (kept for API compatibility) */
  isProcessing: boolean;
  /** The latest processed transcript (set at session end) */
  transcript: string;
  /** Live interim transcript for real-time display (updated on every result event) */
  liveTranscript: string;
  /** Countdown timer percentage (0–100) */
  timeLeft: number;
  /** Whether the browser supports SpeechRecognition */
  speechSupported: boolean;
  /** Start listening (async because it may request mic permission) */
  startListening: () => Promise<void>;
  /** Stop listening and finalize the session */
  stopListening: () => void;
}

// ---------------------------------------------------------------------------
// NATO alphabet mapping
// ---------------------------------------------------------------------------

const NATO: Record<string, string> = {
  alpha: "a",
  bravo: "b",
  charlie: "c",
  delta: "d",
  echo: "e",
  foxtrot: "f",
  golf: "g",
  hotel: "h",
  india: "i",
  juliet: "j",
  kilo: "k",
  lima: "l",
  mike: "m",
  november: "n",
  oscar: "o",
  papa: "p",
  quebec: "q",
  romeo: "r", // fix: was 'rome'
  sierra: "s",
  tango: "t",
  uniform: "u",
  victor: "v",
  whiskey: "w",
  xray: "x",
  yankee: "y",
  zulu: "z",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract spelling from a transcript using NATO phonetic alphabet mapping,
 * single-letter detection, wake/stop word handling, and target-word biasing.
 */
function processSpelling(transcript: string, target?: string): string | null {
  const words = transcript
    .toLowerCase()
    .trim()
    .split(/[\s-]+/);
  if (words.length === 0) return null;

  const targetLower = target?.toLowerCase();

  // Check for "stop" or repeating the word at the end
  const lastWord = words[words.length - 1];
  const isStop =
    lastWord === "stop" || (targetLower && lastWord === targetLower);

  // Check for wake word at the start
  const firstWord = words[0];
  const hasWakeWord = targetLower && firstWord === targetLower;

  // Extract potential spelling words (skip wake word and stop word)
  const spellingStartIndex = hasWakeWord ? 1 : 0;
  const spellingEndIndex = isStop ? words.length - 1 : words.length;
  const spellingWords = words.slice(spellingStartIndex, spellingEndIndex);

  // Convert NATO words to letters and filter for single letters
  const letters = spellingWords
    .map((w) => NATO[w] ?? (w.length === 1 && /^[a-z]$/.test(w) ? w : null))
    .filter(Boolean) as string[];

  // If we have a stop word and extracted letters, return the spelling
  if (isStop && letters.length > 0) {
    return letters.join("");
  }

  // If we have letters but no stop word, return them if we have a decent match
  if (target && letters.length > 0) {
    const spelling = letters.join("");
    if (spelling.length >= target.length * 0.5) {
      return spelling;
    }
  }

  return null;
}

/**
 * Check whether a transcript looks like a whole-word attempt
 * (not letter-by-letter spelling). Used to prompt the user to spell.
 */
function isLikelyWholeWordAttempt(transcript: string): boolean {
  const words = transcript.trim().split(/\s+/);
  // If it's a single word (not single letters), likely a whole-word attempt
  return words.length === 1 && words[0].length > 3;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVoiceRecognition(
  options: VoiceRecognitionOptions,
): UseVoiceRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [timeLeft, setTimeLeft] = useState(100);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const graceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxListenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionCompletedRef = useRef(false);
  const latestTranscriptRef = useRef("");
  const isCleaningUpRef = useRef(false);
  const isMountedRef = useRef(true);
  const isListeningRef = useRef(false);

  // Stable refs for external callbacks so the recognition object is not
  // recreated every time the parent re-renders with new inline function refs.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // -----------------------------------------------------------------------
  // Timer management
  // -----------------------------------------------------------------------

  const clearSilenceTimeout = useCallback(() => {
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (graceTimeoutRef.current) clearTimeout(graceTimeoutRef.current);
    silenceTimeoutRef.current = null;
    graceTimeoutRef.current = null;
  }, []);

  const clearMaxListenTimeout = useCallback(() => {
    if (maxListenTimeoutRef.current) clearTimeout(maxListenTimeoutRef.current);
    maxListenTimeoutRef.current = null;
  }, []);

  const clearProgressTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  // -----------------------------------------------------------------------
  // Session lifecycle
  // -----------------------------------------------------------------------

  const finishListeningSession = useCallback(
    (shouldAutoSubmit: boolean, errorMessage?: string) => {
      if (sessionCompletedRef.current) return;
      sessionCompletedRef.current = true;
      clearSilenceTimeout();
      clearMaxListenTimeout();
      clearProgressTimer();

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          /* ignore */
        }
      }

      isListeningRef.current = false;
      setIsListening(false);
      setIsProcessing(false);

      const finalTranscript = latestTranscriptRef.current.trim();
      if (!finalTranscript) {
        optionsRef.current.onError?.(
          errorMessage ?? "No speech detected. Please try again.",
        );
        return;
      }

      // Check if user spoke the whole word instead of spelling it
      if (isLikelyWholeWordAttempt(finalTranscript)) {
        optionsRef.current.onError?.(
          `I heard "${finalTranscript}". Please spell the word letter-by-letter.`,
        );
        return;
      }

      // Try to extract spelling from the transcript
      const spellingResult = processSpelling(
        finalTranscript,
        optionsRef.current.targetWord,
      );

      setTranscript(finalTranscript);

      if (spellingResult && shouldAutoSubmit) {
        // Auto-submit the spelling result
        optionsRef.current.onResult?.(spellingResult);
      } else if (spellingResult) {
        // Store transcript; the parent component will handle submission
        optionsRef.current.onTranscript?.(finalTranscript);
      } else {
        // Speech was detected but could not be parsed as a spelling.
        // Surface an actionable error so the user isn't left in silence.
        optionsRef.current.onTranscript?.(finalTranscript);
        optionsRef.current.onError?.(
          "Couldn't understand that. Please spell letter-by-letter (or use NATO words like Alpha, Bravo, Charlie…).",
        );
      }
    },
    [clearSilenceTimeout, clearMaxListenTimeout, clearProgressTimer],
  );

  // Keep a stable ref to finishListeningSession so setInterval callbacks
  // always call the latest version without the ref being in the dep array
  // of startProgressTimer (which would cause recreation on every render).
  const finishListeningSessionRef = useRef(finishListeningSession);
  useEffect(() => {
    finishListeningSessionRef.current = finishListeningSession;
  }, [finishListeningSession]);

  const startProgressTimer = useCallback(
    (duration: number) => {
      clearProgressTimer();
      setTimeLeft(100);
      const interval = 100;
      let elapsed = 0;
      timerRef.current = setInterval(() => {
        elapsed += interval;
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
        setTimeLeft(remaining);
        if (remaining <= 0) {
          // Use ref so we always call the latest finishListeningSession
          // without needing it in this callback's closure.
          finishListeningSessionRef.current(false, "Time ran out. Please try again.");
        }
      }, interval);
    },
    [clearProgressTimer],
  );

  const resetSilenceTimeout = useCallback(() => {
    clearSilenceTimeout();
    silenceTimeoutRef.current = setTimeout(() => {
      finishListeningSessionRef.current(true, "No speech detected. Please try again.");
    }, SILENCE_TIMEOUT_MS);
  }, [clearSilenceTimeout]);

  // -----------------------------------------------------------------------
  // Recognition setup — runs once on mount.
  // optionsRef keeps all callbacks fresh so this effect has an empty dep
  // array and never tears down the SpeechRecognition instance mid-session.
  // -----------------------------------------------------------------------

  useEffect(() => {
    isMountedRef.current = true;
    isCleaningUpRef.current = false;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const mergedTranscript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join(" ");

      const nextTranscript = mergedTranscript.trim();
      setLiveTranscript(nextTranscript);
      optionsRef.current.onTranscript?.(nextTranscript);

      // Strip completion cue words
      const withoutCue = nextTranscript
        .replace(COMPLETION_CUE_PATTERN, "")
        .trim();
      if (!withoutCue) {
        // Only completion-cue words were spoken — end session
        latestTranscriptRef.current = "";
        finishListeningSessionRef.current(true);
        return;
      }

      latestTranscriptRef.current = withoutCue;

      // Check for spelling result — if we have one and user is done, submit
      const spellingResult = processSpelling(
        withoutCue,
        optionsRef.current.targetWord,
      );

      // Check for completion cue in the original transcript
      if (COMPLETION_CUE_DETECTION_PATTERN.test(nextTranscript.toLowerCase())) {
        // User signalled they are done spelling
        if (spellingResult) {
          optionsRef.current.onResult?.(spellingResult);
        }
        finishListeningSessionRef.current(true);
      } else if (spellingResult) {
        // We have a valid spelling — submit it and end the session
        optionsRef.current.onResult?.(spellingResult);
        finishListeningSessionRef.current(true);
      } else {
        // Still spelling — keep the session alive
        resetSilenceTimeout();
      }
    };

    recognition.onerror = (event: any) => {
      if (!isMountedRef.current) return;

      const error = event.error;
      if (error === "aborted" && isCleaningUpRef.current) return;

      clearSilenceTimeout();
      clearMaxListenTimeout();
      clearProgressTimer();
      isListeningRef.current = false;
      setIsListening(false);
      sessionCompletedRef.current = true;

      if (error === "no-speech") {
        optionsRef.current.onError?.("No speech detected. Please try again.");
      } else if (error === "not-allowed" || error === "service-not-allowed") {
        optionsRef.current.onError?.(
          "Microphone permission denied. Please enable microphone access.",
        );
      } else if (error === "network") {
        optionsRef.current.onError?.(
          "Network error. Please check your internet connection.",
        );
      } else if (error === "audio-capture") {
        optionsRef.current.onError?.(
          "Microphone not available. Check your audio device.",
        );
      } else if (error === "aborted") {
        // Interruption — don't surface as error to the user
      } else {
        optionsRef.current.onError?.(`Speech recognition error: ${error}`);
      }
    };

    recognition.onend = () => {
      const endedWhileListening = isListeningRef.current;
      isListeningRef.current = false;

      if (isMountedRef.current) {
        setIsListening(false);
        setIsProcessing(false);
      }

      clearSilenceTimeout();

      if (
        !sessionCompletedRef.current &&
        !isCleaningUpRef.current &&
        endedWhileListening
      ) {
        graceTimeoutRef.current = setTimeout(
          () => finishListeningSessionRef.current(true),
          TRANSCRIPT_GRACE_PERIOD_MS,
        );
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isMountedRef.current = false;
      isCleaningUpRef.current = true;
      clearSilenceTimeout();
      clearMaxListenTimeout();
      clearProgressTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* ignore */
        }
      }
    };
    // Empty dep array: optionsRef + finishListeningSessionRef keep
    // callbacks fresh without triggering SpeechRecognition recreation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  const startListening = useCallback(async () => {
    if (isListening) return;
    if (!recognitionRef.current) {
      optionsRef.current.onError?.(
        "Speech recognition not supported in this browser.",
      );
      return;
    }

    // Reset state
    setTranscript("");
    setLiveTranscript("");
    latestTranscriptRef.current = "";
    sessionCompletedRef.current = false;
    setIsListening(true);
    isListeningRef.current = true;
    resetSilenceTimeout();

    const duration = optionsRef.current.timeout ?? MAX_LISTEN_MS;
    startProgressTimer(duration);

    // Set max listen timeout
    maxListenTimeoutRef.current = setTimeout(() => {
      if (!sessionCompletedRef.current) {
        finishListeningSessionRef.current(false, "Time ran out. Please try again.");
      }
    }, duration);

    try {
      recognitionRef.current.start();
    } catch {
      isListeningRef.current = false;
      setIsListening(false);
      clearSilenceTimeout();
      clearMaxListenTimeout();
      clearProgressTimer();
      optionsRef.current.onError?.("Failed to start speech recognition.");
    }
  }, [
    isListening,
    resetSilenceTimeout,
    startProgressTimer,
    clearSilenceTimeout,
    clearMaxListenTimeout,
    clearProgressTimer,
  ]);

  const stopListening = useCallback(() => {
    finishListeningSession(false);
  }, [finishListeningSession]);

  return {
    isListening,
    isProcessing,
    transcript,
    liveTranscript,
    timeLeft,
    speechSupported,
    startListening,
    stopListening,
  };
}
