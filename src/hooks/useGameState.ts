/**
 * useGameState — Full game orchestrator hook.
 *
 * Coordinates the game FSM (backed by useGameStore), round-level lifecycle,
 * hint delivery, TTS feedback, pause/resume, and session persistence.
 *
 * **No duplicate game state:** all authoritative state (score, streak, words,
 * rounds) is read from useGameStore. This hook adds:
 *  - `RoundPhase` lifecycle tracking (finer-grained than the store's GamePhase)
 *  - `GameStatus` session-level status (lobby / active / paused / session-complete)
 *  - Hint management via useHints
 *  - TTS word announcement and feedback via useSpeechSynthesis
 *  - Session save on end via saveGameSession() from src/lib/db.ts
 *
 * @example
 * ```tsx
 * function GameBoard() {
 *   const {
 *     phase, roundPhase, gameStatus, currentWord, score, streak,
 *     hintsRemaining, startSession, submitAnswer, requestHint,
 *     pauseGame, resumeGame, endSession,
 *   } = useGameState();
 *
 *   if (gameStatus === 'lobby') return <StartScreen onStart={startSession} />;
 *   if (gameStatus === 'session-complete') return <SessionSummary />;
 *   if (gameStatus === 'paused') return <PausedScreen onResume={resumeGame} />;
 *   return <ActiveRound word={currentWord} onSubmit={submitAnswer} onHint={requestHint} />;
 * }
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameStore } from "./useGameStore";
import { useSpeechSynthesis } from "./useSpeechSynthesis";
import { useHints } from "./useHints";
import { useHostMessages } from "./useHostMessages";
import { saveGameSession } from "../lib/db";
import { MAX_HINTS_PER_WORD } from "../constants/game";
import { normalizeSpelling } from "../game-engine/normalization";
import { loadWordsForGrade } from "../lib/wordLoader";
import type { Word } from "../types";
import type { Hint, HintType } from "./useHints.types";
import type {
  GamePhase,
  RoundPhase,
  GameStatus,
  LastAnswer,
  UseGameStateReturn,
} from "./useGameState.types";

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/** Default number of rounds per session when none is specified. */
const DEFAULT_TOTAL_ROUNDS = 10;

/** Delay (ms) after word announcement before transitioning to listening phase. */
const WORD_ANNOUNCE_DELAY_MS = 800;

/** Delay (ms) after evaluating correctness before showing result feedback. */
const EVALUATION_DELAY_MS = 300;

/** Delay (ms) after feedback before marking the round as complete. */
const FEEDBACK_DISPLAY_MS = 1500;

/** Delay (ms) after showing a hint before returning to listening. */
const HINT_DISPLAY_MS = 500;

// ---------------------------------------------------------------------------
// Legacy re-export for backward compatibility
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `UseGameStateReturn` instead. Kept for backward compatibility.
 */
export interface UseGameStateResult {
  phase: GamePhase;
  result: import("./useGameStore").GameResult | null;
  startSession: () => Promise<void>;
  submitAnswer: (answer: string, isVoice?: boolean) => boolean | null;
  timeoutRound: () => void;
  nextWord: () => void;
  restartGame: () => void;
  setPhase: (phase: GamePhase) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Full game orchestrator. Subscribes to useGameStore for authoritative state
 * and adds round lifecycle, hint management, TTS feedback, and session save.
 */
export function useGameState(): UseGameStateReturn {
  // --- Subscribe to useGameStore (no state duplication) ---
  const phase = useGameStore((s) => s.phase);
  const result = useGameStore((s) => s.result);
  const currentWord = useGameStore((s) => s.currentWord);
  const score = useGameStore((s) => s.score);
  const streak = useGameStore((s) => s.streak);
  const bestStreak = useGameStore((s) => s.bestStreak);
  const roundsPlayed = useGameStore((s) => s.roundsPlayed);
  const correctAnswers = useGameStore((s) => s.correctAnswers);
  const difficultyEvolution = useGameStore((s) => s.difficultyEvolution);
  const sessionStartTime = useGameStore((s) => s.sessionStartTime);
  const sessionBaseline = useGameStore((s) => s.sessionBaseline);

  const startSession = useGameStore((s) => s.startSession);
  const submitAnswer = useGameStore((s) => s.submitAnswer);
  const timeoutRound = useGameStore((s) => s.timeoutRound);
  const nextWord = useGameStore((s) => s.nextWord);
  const restartGame = useGameStore((s) => s.restartGame);
  const setPhase = useGameStore((s) => s.setPhase);
  const userId = useGameStore((s) => s.userId);

  // --- Configurable round count (defaults to 10) ---
  const totalRoundsRef = useRef<number>(DEFAULT_TOTAL_ROUNDS);

  // --- Compose side-effect hooks ---
  const {
    speak,
    ttsSupported,
    repeatWord: ttsRepeatWord,
  } = useSpeechSynthesis({
    addMessage: () => {}, // Messages are managed by useHostMessages
    soundEnabled: true, // Controlled by SettingsPanel → audioManager
  });
  const { hints, addHint, clearHints } = useHints();
  const { triggerMessage, clearMessage } = useHostMessages();

  // --- Round-phase lifecycle (local state) ---
  const [roundPhase, setRoundPhase] = useState<RoundPhase>("idle");
  const [lastAnswer, setLastAnswer] = useState<LastAnswer | null>(null);

  // --- Session status (local state) ---
  const [gameStatus, setGameStatus] = useState<GameStatus>("lobby");

  // --- Refs for timer cleanup (fixes #8, #9) ---
  const roundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordAnnounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // --- Track the last word we announced to avoid stale announcements (fix #12) ---
  const lastAnnouncedWordRef = useRef<string | null>(null);

  // Track the previous phase to detect transitions
  const prevPhaseRef = useRef<GamePhase>("idle");

  // --- Cleanup all timers ---
  const clearAllTimers = useCallback(() => {
    if (roundTimerRef.current) {
      clearTimeout(roundTimerRef.current);
      roundTimerRef.current = null;
    }
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    if (wordAnnounceTimerRef.current) {
      clearTimeout(wordAnnounceTimerRef.current);
      wordAnnounceTimerRef.current = null;
    }
  }, []);

  // --- Round-phase transitions driven by store phase changes (fix #12) ---
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    if (prev === "idle" && phase === "playing") {
      // New round started → word announced → listening
      setRoundPhase("word-announced");
      clearAllTimers();

      // Speak the word and generate a hint only if it's a NEW word
      if (currentWord && currentWord.word !== lastAnnouncedWordRef.current) {
        lastAnnouncedWordRef.current = currentWord.word;
        void ttsRepeatWord(currentWord.word);
        addHint(currentWord);
      }

      wordAnnounceTimerRef.current = setTimeout(() => {
        setRoundPhase("listening");
        wordAnnounceTimerRef.current = null;
      }, WORD_ANNOUNCE_DELAY_MS);
      return clearAllTimers;
    }

    if (prev === "playing" && phase === "round_end") {
      // Round ended → evaluate correctness
      setRoundPhase("evaluating");
      clearAllTimers();

      roundTimerRef.current = setTimeout(() => {
        if (result?.isCorrect) {
          setRoundPhase("correct");
          triggerMessage("correct", speak);
        } else {
          setRoundPhase("incorrect");
          triggerMessage("incorrect", speak);
        }
        roundTimerRef.current = null;

        // After showing result, mark round as complete
        roundTimerRef.current = setTimeout(() => {
          setRoundPhase("round-complete");
          roundTimerRef.current = null;
        }, FEEDBACK_DISPLAY_MS);
      }, EVALUATION_DELAY_MS);
      return clearAllTimers;
    }

    if (prev === "round_end" && phase === "playing") {
      // Next word → back to word-announced (fix #12: check word changed)
      clearAllTimers();

      if (currentWord && currentWord.word !== lastAnnouncedWordRef.current) {
        lastAnnouncedWordRef.current = currentWord.word;
        setRoundPhase("word-announced");
        clearMessage();
        clearHints();
        void ttsRepeatWord(currentWord.word);
        addHint(currentWord);

        wordAnnounceTimerRef.current = setTimeout(() => {
          setRoundPhase("listening");
          wordAnnounceTimerRef.current = null;
        }, WORD_ANNOUNCE_DELAY_MS);
      } else if (currentWord) {
        // Word didn't change yet — wait for it
        setRoundPhase("word-announced");
        clearMessage();
        clearHints();
      } else {
        setRoundPhase("idle");
      }
      return clearAllTimers;
    }

    if (phase === "idle" && prev !== "idle") {
      clearAllTimers();
      setRoundPhase("idle");
      clearMessage();
      clearHints();
      lastAnnouncedWordRef.current = null;
    }
  }, [
    phase,
    currentWord,
    result,
    ttsRepeatWord,
    addHint,
    triggerMessage,
    speak,
    clearMessage,
    clearHints,
    clearAllTimers,
  ]);

  // --- Session status tracking ---
  useEffect(() => {
    if (phase === "idle" && roundsPlayed === 0 && correctAnswers === 0) {
      setGameStatus("lobby");
    } else if (phase === "playing" || phase === "round_end") {
      setGameStatus((prev) => (prev === "paused" ? "paused" : "active"));
    }
  }, [phase, roundsPlayed, correctAnswers]);

  // --- Session completion check (fix #6) ---
  useEffect(() => {
    if (gameStatus === "active" && roundsPlayed >= totalRoundsRef.current) {
      setGameStatus("session-complete");
      triggerMessage("session-complete", speak);
    }
  }, [gameStatus, roundsPlayed, triggerMessage, speak]);

  // --- Hint tracking ---
  const hintsRemaining = Math.max(0, MAX_HINTS_PER_WORD - hints.length);

  // --- Derived values (fix #10: compute from store baselines) ---
  const roundIndex = Math.max(
    0,
    roundsPlayed - (phase === "round_end" ? 1 : 0),
  );
  const wasCorrect = lastAnswer?.wasCorrect ?? result?.isCorrect ?? null;

  // --- Request a hint (fix #2: accept HintType, fix #9: track timer in ref) ---
  const requestHint = useCallback(
    (type?: HintType) => {
      if (phase !== "playing" || hintsRemaining <= 0 || !currentWord) return;

      // Clear any pending hint timer from a previous hint
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
      }

      const hint = addHint(currentWord);
      if (hint) {
        setRoundPhase("hint-shown");
        triggerMessage("hint-used");
        // Return to listening after showing hint
        hintTimerRef.current = setTimeout(() => {
          setRoundPhase("listening");
          hintTimerRef.current = null;
        }, HINT_DISPLAY_MS);
      }
    },
    [phase, hintsRemaining, currentWord, addHint, triggerMessage],
  );

  // --- Repeat word via TTS ---
  const repeatWord = useCallback(async () => {
    if (!currentWord) return;
    await ttsRepeatWord(currentWord.word);
  }, [currentWord, ttsRepeatWord]);

  // --- Wrapped submitAnswer (fix #5: use normalizeSpelling, fix #11) ---
  const wrappedSubmitAnswer = useCallback(
    (answer: string, isVoice = false): boolean | null => {
      if (gameStatus === "paused") return null;

      // Use the same normalization as the store for consistency
      const normalized = normalizeSpelling(answer);
      const outcome = submitAnswer(answer, isVoice);

      if (outcome !== null) {
        setLastAnswer({
          raw: answer,
          normalized,
          isVoice,
          wasCorrect: outcome,
        });
      }

      return outcome;
    },
    [submitAnswer, gameStatus],
  );

  // --- Pause / Resume ---
  const pauseGame = useCallback(() => {
    setGameStatus("paused");
  }, []);

  const resumeGame = useCallback(() => {
    setGameStatus("active");
  }, []);

  // --- End session — save to IndexedDB via saveGameSession() from db.ts (fix #1) ---
  const endSession = useCallback(async () => {
    if (userId && roundsPlayed > 0) {
      try {
        // Compute session-local stats using baselines (fix #10)
        const sessionWords =
          roundsPlayed - (sessionBaseline?.roundsPlayed ?? 0);
        const sessionCorrect =
          correctAnswers - (sessionBaseline?.correctAnswers ?? 0);

        await saveGameSession({
          uid: userId,
          startTime: sessionStartTime
            ? new Date(sessionStartTime).toISOString()
            : new Date().toISOString(),
          endTime: new Date().toISOString(),
          wordsSpelled: Math.max(0, sessionWords),
          correctCount: Math.max(0, sessionCorrect),
          difficultyEvolution: difficultyEvolution ?? [],
          synced: false,
        });
      } catch (err) {
        console.warn("[useGameState] Failed to save session to IndexedDB", err);
      }
    }

    triggerMessage("session-complete", speak);
    setGameStatus("session-complete");
    setRoundPhase("round-complete");
    clearAllTimers();
  }, [
    userId,
    roundsPlayed,
    correctAnswers,
    sessionBaseline,
    sessionStartTime,
    difficultyEvolution,
    triggerMessage,
    speak,
    clearAllTimers,
  ]);

  // --- Wrapped startSession: pre-load words, then start ---
  // On any failure: restore gameStatus to 'lobby' to avoid leaving the UI in
  // a broken 'active' state where the game view is shown but no session exists.
  const wrappedStartSession = useCallback(
    async (roundCount?: number) => {
      // Set configurable round count
      if (roundCount && roundCount > 0) {
        totalRoundsRef.current = roundCount;
      }

      clearHints();
      setLastAnswer(null);
      setGameStatus("active");
      setRoundPhase("idle");
      lastAnnouncedWordRef.current = null;

      try {
        // Pre-load words for the configured grade level
        const grade = useGameStore.getState().gradeLevel;
        await loadWordsForGrade(grade);
        await startSession();
      } catch (err) {
        console.warn(
          "[useGameState] wrappedStartSession: failed to start session",
          err,
        );
        // Restore lobby state so the UI doesn't show an empty active game
        setGameStatus("lobby");
        setRoundPhase("idle");
      }
    },
    [startSession, clearHints],
  );

  // --- Wrapped restartGame that resets local state ---
  const wrappedRestartGame = useCallback(() => {
    clearHints();
    setLastAnswer(null);
    setGameStatus("lobby");
    setRoundPhase("idle");
    totalRoundsRef.current = DEFAULT_TOTAL_ROUNDS;
    lastAnnouncedWordRef.current = null;
    clearAllTimers();
    restartGame();
  }, [restartGame, clearHints, clearAllTimers]);

  // --- Build hints array typed properly ---
  const typedHints: Hint[] = hints as Hint[];

  return {
    // FSM state
    phase,
    roundPhase,
    gameStatus,
    result,

    // Gameplay state (from store)
    currentWord: currentWord as Word | null,
    score,
    streak,
    bestStreak,
    roundsPlayed,
    correctAnswers,
    roundIndex,
    totalRounds: totalRoundsRef.current,
    hintsRemaining,
    lastAnswer,
    wasCorrect,
    hints: typedHints,

    // FSM transitions
    startSession: wrappedStartSession as (roundCount?: number) => Promise<void>,
    submitAnswer: wrappedSubmitAnswer,
    timeoutRound,
    nextWord,
    restartGame: wrappedRestartGame,
    setPhase,

    // Session management
    pauseGame,
    resumeGame,
    endSession,

    // Hint & TTS helpers
    requestHint: requestHint as () => void,
    repeatWord,
  };
}

// Re-export canonical FSM types so consumers can import from one place.
export type {
  GamePhase,
  RoundPhase,
  GameStatus,
  LastAnswer,
  UseGameStateReturn,
} from "./useGameState.types";
export type { GameFSMEvent, FSMTransitionMap } from "./useGameState.types";
