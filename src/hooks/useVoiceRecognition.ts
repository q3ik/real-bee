import { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Constants
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
  romeo: "r",
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
  const maxListenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionCompletedRef = useRef(false);
  const latestTranscriptRef = useRef("");
  const isCleaningUpRef = useRef(false);
  const isMountedRef = useRef(true);
  const isListeningRef = useRef(false);

  // Stable ref for options — keeps callbacks fresh without recreating recognition.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // -----------------------------------------------------------------------
  // Timer helpers
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

  /**
   * Terminate the current listening session.
   *
   * @param shouldAutoSubmit - When true and a spelling result is available,
   *   `onResult` is called automatically.
   * @param errorMessage - Optional override for the "no speech" error message.
   * @param precomputedResult - A spelling result already derived by the
   *   `onresult` handler. When supplied, `finishListeningSession` uses it
   *   directly instead of re-running `processSpelling`, ensuring `onResult`
   *   is called **at most once** per session (here, not in the caller).
   */
  const finishListeningSession = useCallback(
    (
      shouldAutoSubmit: boolean,
      errorMessage?: string,
      precomputedResult?: string | null,
    ) => {
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

      setTranscript(finalTranscript);

      // Use the result pre-computed by `onresult` when available; otherwise
      // derive it now (timeout / grace-period paths where onresult didn't fire).
      const spellingResult =
        precomputedResult !== undefined
          ? precomputedResult
          : processSpelling(finalTranscript, optionsRef.current.targetWord);

      if (spellingResult && shouldAutoSubmit) {
        // `onResult` is called exactly once — right here.
        optionsRef.current.onResult?.(spellingResult);
      } else if (spellingResult) {
        // No auto-submit: surface the raw transcript so the UI can show it.
        optionsRef.current.onTranscript?.(finalTranscript);
      } else {
        // Speech detected but could not be parsed as a spelling.
        optionsRef.current.onTranscript?.(finalTranscript);
        optionsRef.current.onError?.(
          "Couldn't understand that. Please spell letter-by-letter (or use NATO words like Alpha, Bravo, Charlie…).",
        );
      }
    },
    [clearSilenceTimeout, clearMaxListenTimeout, clearProgressTimer],
  );

  // Stable ref so setInterval / setTimeout closures always call the latest
  // finishListeningSession without it appearing in their dep arrays.
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
  // optionsRef / finishListeningSessionRef keep everything fresh.
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

      // Strip completion cue words before evaluating the spelling
      const withoutCue = nextTranscript
        .replace(COMPLETION_CUE_PATTERN, "")
        .trim();
      if (!withoutCue) {
        // Only completion-cue words were spoken — end session with no result
        latestTranscriptRef.current = "";
        finishListeningSessionRef.current(true);
        return;
      }

      latestTranscriptRef.current = withoutCue;

      // Derive the spelling result once here so it can be passed into
      // finishListeningSession, preventing a second processSpelling call
      // and therefore a duplicate onResult invocation.
      const spellingResult = processSpelling(
        withoutCue,
        optionsRef.current.targetWord,
      );

      const hasCue = COMPLETION_CUE_DETECTION_PATTERN.test(nextTranscript.toLowerCase());

      if (hasCue || spellingResult) {
        // User is done (explicit cue or a complete spelling detected).
        // Pass the precomputed result into finishListeningSession so it
        // is used directly — onResult fires once, inside finishListeningSession.
        finishListeningSessionRef.current(true, undefined, spellingResult);
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
        // Deliberate interruption — don't surface to the user
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
        // Grace period: collect any final transcript fragment before finalising
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
    // Empty dep array intentional: optionsRef + finishListeningSessionRef
    // keep all callbacks current without recreating the recognition object.
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

    setTranscript("");
    setLiveTranscript("");
    latestTranscriptRef.current = "";
    sessionCompletedRef.current = false;
    setIsListening(true);
    isListeningRef.current = true;
    resetSilenceTimeout();

    const duration = optionsRef.current.timeout ?? MAX_LISTEN_MS;
    startProgressTimer(duration);

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
