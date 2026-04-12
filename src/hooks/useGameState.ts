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
 *  - Session save on end via storage.ts
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
import { saveSession } from "../game-engine/storage";
import { MAX_HINTS_PER_WORD } from "../constants/game";
import type { Word } from "../lib/wordList";
import type { Hint } from "./useHints.types";
import type {
  GamePhase,
  RoundPhase,
  GameStatus,
  LastAnswer,
  UseGameStateReturn,
} from "./useGameState.types";

// ---------------------------------------------------------------------------
// Legacy re-export for backward compatibility
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `UseGameStateReturn` instead. Kept for backward compatibility.
 */
export interface UseGameStateResult {
  phase: GamePhase;
  result: import("./useGameStore").GameResult | null;
  startSession: () => void;
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
  const usedWords = useGameStore((s) => s.usedWords);

  const startSession = useGameStore((s) => s.startSession);
  const submitAnswer = useGameStore((s) => s.submitAnswer);
  const timeoutRound = useGameStore((s) => s.timeoutRound);
  const nextWord = useGameStore((s) => s.nextWord);
  const restartGame = useGameStore((s) => s.restartGame);
  const setPhase = useGameStore((s) => s.setPhase);
  const userId = useGameStore((s) => s.userId);

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

  // Track the previous phase to detect transitions
  const prevPhaseRef = useRef<GamePhase>("idle");

  // --- Round-phase transitions driven by store phase changes ---
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    if (prev === "idle" && phase === "playing") {
      // New round started → word announced → listening
      setRoundPhase("word-announced");
      // Speak the word aloud
      if (currentWord) {
        void ttsRepeatWord(currentWord.word);
        // Generate a hint for this word
        addHint(currentWord);
      }
      // After a brief delay, transition to listening
      const timer = setTimeout(() => {
        setRoundPhase("listening");
      }, 800);
      return () => clearTimeout(timer);
    }

    if (prev === "playing" && phase === "round_end") {
      // Round ended → evaluate correctness
      setRoundPhase("evaluating");
      const timer = setTimeout(() => {
        if (result?.isCorrect) {
          setRoundPhase("correct");
          triggerMessage("correct");
        } else {
          setRoundPhase("incorrect");
          triggerMessage("incorrect");
        }
        // After showing result, mark round as complete
        const completeTimer = setTimeout(() => {
          setRoundPhase("round-complete");
        }, 1500);
        return () => clearTimeout(completeTimer);
      }, 300);
      return () => clearTimeout(timer);
    }

    if (prev === "round_end" && phase === "playing") {
      // Next word → back to word-announced
      setRoundPhase("word-announced");
      clearMessage();
      clearHints();
      if (currentWord) {
        void ttsRepeatWord(currentWord.word);
        addHint(currentWord);
      }
      const timer = setTimeout(() => {
        setRoundPhase("listening");
      }, 800);
      return () => clearTimeout(timer);
    }

    if (phase === "idle" && prev !== "idle") {
      setRoundPhase("idle");
      clearMessage();
      clearHints();
    }
  }, [
    phase,
    currentWord,
    result,
    ttsRepeatWord,
    addHint,
    triggerMessage,
    clearMessage,
    clearHints,
  ]);

  // --- Session status tracking ---
  useEffect(() => {
    if (phase === "idle" && roundsPlayed === 0 && correctAnswers === 0) {
      setGameStatus("lobby");
    } else if (phase === "playing" || phase === "round_end") {
      setGameStatus((prev) => (prev === "paused" ? "paused" : "active"));
    }
  }, [phase, roundsPlayed, correctAnswers]);

  // --- Hint tracking ---
  const hintsRemaining = Math.max(0, MAX_HINTS_PER_WORD - hints.length);

  // --- Derived values ---
  const roundIndex = Math.max(
    0,
    roundsPlayed - (phase === "round_end" ? 1 : 0),
  );
  // totalRounds is unbounded (endless mode); use a sentinel
  const totalRounds = Infinity;
  const wasCorrect = lastAnswer?.wasCorrect ?? result?.isCorrect ?? null;

  // --- Request a hint ---
  const requestHint = useCallback(() => {
    if (phase !== "playing" || hintsRemaining <= 0 || !currentWord) return;

    const hint = addHint(currentWord);
    if (hint) {
      setRoundPhase("hint-shown");
      triggerMessage("hint-used");
      // Return to listening after showing hint
      setTimeout(() => {
        setRoundPhase("listening");
      }, 500);
    }
  }, [phase, hintsRemaining, currentWord, addHint, triggerMessage]);

  // --- Repeat word via TTS ---
  const repeatWord = useCallback(async () => {
    if (!currentWord) return;
    await ttsRepeatWord(currentWord.word);
  }, [currentWord, ttsRepeatWord]);

  // --- Wrapped submitAnswer that tracks lastAnswer and round phase ---
  const wrappedSubmitAnswer = useCallback(
    (answer: string, isVoice = false): boolean | null => {
      if (gameStatus === "paused") return null;

      const normalized = answer.trim().toLowerCase();
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

  // --- End session — save to IndexedDB ---
  const endSession = useCallback(async () => {
    if (userId && roundsPlayed > 0) {
      try {
        await saveSession({
          uid: userId,
          startTime: new Date(Date.now() - roundsPlayed * 60_000).toISOString(),
          endTime: new Date().toISOString(),
          wordsSpelled: roundsPlayed,
          correctCount: correctAnswers,
          difficultyEvolution: [],
          synced: false,
        });
      } catch (err) {
        console.warn("[useGameState] Failed to save session to IndexedDB", err);
      }
    }

    triggerMessage("session-complete");
    setGameStatus("session-complete");
    setRoundPhase("round-complete");
  }, [userId, roundsPlayed, correctAnswers, triggerMessage]);

  // --- Wrapped startSession that resets local state ---
  const wrappedStartSession = useCallback(() => {
    clearHints();
    setLastAnswer(null);
    setGameStatus("active");
    setRoundPhase("idle");
    startSession();
  }, [startSession, clearHints]);

  // --- Wrapped restartGame that resets local state ---
  const wrappedRestartGame = useCallback(() => {
    clearHints();
    setLastAnswer(null);
    setGameStatus("lobby");
    setRoundPhase("idle");
    restartGame();
  }, [restartGame, clearHints]);

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
    totalRounds,
    hintsRemaining,
    lastAnswer,
    wasCorrect,
    hints: typedHints,

    // FSM transitions
    startSession: wrappedStartSession,
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
    requestHint,
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
