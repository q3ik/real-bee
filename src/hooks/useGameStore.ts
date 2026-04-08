import { create } from "zustand";
import { type Word, getWordsForConfig } from "../lib/wordList";
import { localDb } from "../lib/db";
import { supabase } from "../lib/supabase";
import type { GamePhase } from "../hooks/useGameKeyboardShortcuts.types";

// ---------------------------------------------------------------------------
// Types (ported from buzzy-game useGameState.types, adapted for real-bee)
// ---------------------------------------------------------------------------

export type GameDifficulty = "easy" | "medium" | "hard" | "all";

export interface GameResult {
  isCorrect: boolean;
  points: number;
  newScore: number;
  newStreak: number;
  newBestStreak: number;
  feedback: string;
  targetWord: string;
  rawInput: string;
  normalizedInput: string;
  isVoice: boolean;
}

export interface SessionStat {
  label: string;
  value: string | number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STREAK_MILESTONES = [5, 10, 15, 20];

function generateFeedback(
  isCorrect: boolean,
  streak: number,
  targetWord: string,
): string {
  if (isCorrect) {
    if (STREAK_MILESTONES.includes(streak)) {
      return `Correct! Amazing. ${streak} in a row!`;
    }
    return "Correct! Well done!";
  }
  return `Not quite. The word was ${targetWord}.`;
}

function mapGradeLevelToString(gradeLevel: number): string {
  if (gradeLevel === 0) return "all";
  if (gradeLevel === 1) return "K-2";
  if (gradeLevel === 3) return "3-5";
  if (gradeLevel === 6) return "6-8";
  return "all";
}

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

interface GameState {
  // --- FSM phase ---
  phase: GamePhase;
  result: GameResult | null;

  // --- Gameplay ---
  score: number;
  streak: number;
  bestStreak: number;
  masteredCount: number;
  masteredWords: string[];
  currentWord: Word | null;
  sessionWords: Word[];
  sessionIndex: number;
  difficultyEvolution: number[];
  recentPerformance: boolean[];
  roundsPlayed: number;
  correctAnswers: number;
  sessionStartTime: number | null;
  sessionBestStreak: number;

  // --- Config (persisted via Dexie) ---
  gradeLevel: number;
  difficulty: GameDifficulty;
  isMuted: boolean;
  voiceQuality: "natural" | "standard";
  listeningTimeout: "normal" | "longer" | "off";
  showLetterCount: boolean;
  autoListen: boolean;
  autoSubmit: boolean;

  // --- Auth ---
  userId: string | null;

  // --- Actions: FSM ---
  setPhase: (phase: GamePhase) => void;

  // --- Actions: Session ---
  startSession: () => void;
  startNewRound: () => void;
  nextWord: () => void;
  restartGame: () => void;

  // --- Actions: Submission ---
  submitAnswer: (answer: string, isVoice?: boolean) => boolean;
  timeoutRound: () => void;

  // --- Actions: Mastery ---
  toggleMastery: (word: string, shouldMaster: boolean) => void;

  // --- Actions: Config ---
  setGradeLevel: (grade: number) => void;
  setDifficulty: (diff: GameDifficulty) => void;
  toggleMute: () => void;
  toggleLetterCount: () => void;
  toggleAutoListen: () => void;
  setVoiceQuality: (q: "natural" | "standard") => void;
  setListeningTimeout: (t: "normal" | "longer" | "off") => void;
  setMuted: (muted: boolean) => void;
  setAutoSubmit: (autoSubmit: boolean) => void;

  // --- Actions: Persistence ---
  loadProgress: () => Promise<void>;

  // --- Computed helpers ---
  sessionStats: () => SessionStat[];
}

// Keep track of used words during a session
const usedWordsSet = new Set<string>();
const masteredWordsSet = new Set<string>();

export const useGameStore = create<GameState>((set, get) => ({
  // --- FSM ---
  phase: "idle",
  result: null,

  // --- Gameplay defaults ---
  score: 0,
  streak: 0,
  bestStreak: 0,
  masteredCount: 0,
  masteredWords: [],
  currentWord: null,
  sessionWords: [],
  sessionIndex: 0,
  difficultyEvolution: [],
  recentPerformance: [],
  roundsPlayed: 0,
  correctAnswers: 0,
  sessionStartTime: null,
  sessionBestStreak: 0,

  // --- Config ---
  gradeLevel: 1,
  difficulty: "easy",
  isMuted: false,
  voiceQuality: "natural",
  listeningTimeout: "normal",
  showLetterCount: true,
  autoListen: false,
  autoSubmit: false,

  // --- Auth ---
  userId: null,

  // --- Actions ---
  setPhase: (phase) =>
    set({ phase, result: phase === "idle" ? null : get().result }),

  startSession: () => {
    usedWordsSet.clear();
    masteredWordsSet.clear();
    set({
      score: 0,
      streak: 0,
      roundsPlayed: 0,
      correctAnswers: 0,
      sessionStartTime: null,
      sessionBestStreak: 0,
      recentPerformance: [],
      difficultyEvolution: [],
      result: null,
    });
    get().startNewRound();
  },

  startNewRound: () => {
    const {
      gradeLevel,
      difficulty,
      recentPerformance,
      sessionWords,
      sessionIndex,
    } = get();

    // Start session timer on first round
    if (!get().sessionStartTime) {
      set({ sessionStartTime: Date.now(), sessionBestStreak: 0 });
    }

    // Get words — reuse session words if we already have them, or fetch new ones
    let pool = sessionWords;
    if (pool.length === 0 || sessionIndex >= pool.length) {
      pool = getWordsForConfig(gradeLevel, difficulty);
      pool = [...pool].sort(() => Math.random() - 0.5);
    }

    // Filter out used words
    const availableWords = pool.filter((w: Word) => !usedWordsSet.has(w.word));

    if (availableWords.length === 0) {
      set({
        phase: "idle",
        currentWord: null,
        sessionWords: [],
        sessionIndex: 0,
      });
      return;
    }

    const word =
      availableWords[Math.floor(Math.random() * availableWords.length)];
    usedWordsSet.add(word.word);

    set({
      currentWord: word,
      sessionWords: pool,
      sessionIndex: sessionIndex + 1,
      phase: "playing",
      result: null,
    });
  },

  submitAnswer: (answer, isVoice = false) => {
    const {
      currentWord,
      phase,
      streak,
      score,
      bestStreak,
      roundsPlayed,
      correctAnswers,
      userId,
      gradeLevel,
      difficulty,
      isMuted: muted,
    } = get();
    if (!currentWord || phase !== "playing") return false;

    const normalized = answer.toLowerCase().replace(/\s/g, "");
    if (!normalized) return false;

    const isCorrect = normalized === currentWord.word.toLowerCase();
    const newStreak = isCorrect ? streak + 1 : 0;
    const newScore = isCorrect ? score + 10 * newStreak : score;
    const newBestStreak = Math.max(bestStreak, newStreak);
    const newMastered = isCorrect
      ? get().masteredCount + 1
      : get().masteredCount;
    const newCorrect = isCorrect ? correctAnswers + 1 : correctAnswers;
    const newRounds = roundsPlayed + 1;

    const feedback = generateFeedback(isCorrect, newStreak, currentWord.word);

    const evolutionEntry = isCorrect ? 1 : -1;

    if (isCorrect && userId) {
      void localDb.progress.put({
        uid: userId,
        score: newScore,
        streak: newStreak,
        bestStreak: newBestStreak,
        masteredCount: newMastered,
        gradeLevel: gradeLevel.toString(),
        difficulty,
        lastPlayed: new Date().toISOString(),
        synced: false,
      });
    }

    set({
      score: newScore,
      streak: newStreak,
      bestStreak: newBestStreak,
      masteredCount: newMastered,
      roundsPlayed: newRounds,
      correctAnswers: newCorrect,
      difficultyEvolution: [...get().difficultyEvolution, evolutionEntry],
      recentPerformance: [...get().recentPerformance, isCorrect].slice(-10),
      sessionBestStreak: Math.max(get().sessionBestStreak, newStreak),
      phase: "round_end",
      result: {
        isCorrect,
        points: isCorrect ? 10 * newStreak : 0,
        newScore,
        newStreak,
        newBestStreak,
        feedback,
        targetWord: currentWord.word,
        rawInput: answer,
        normalizedInput: normalized,
        isVoice,
      },
    });

    return isCorrect;
  },

  timeoutRound: () => {
    const { currentWord, phase, roundsPlayed } = get();
    if (!currentWord || phase !== "playing") return;

    set({
      roundsPlayed: roundsPlayed + 1,
      // -1 represents a timeout penalty in difficulty evolution tracking (same as an incorrect answer)
      difficultyEvolution: [...get().difficultyEvolution, -1],
      recentPerformance: [...get().recentPerformance, false].slice(-10),
      phase: "round_end",
      result: {
        isCorrect: false,
        points: 0,
        newScore: get().score,
        newStreak: 0,
        newBestStreak: get().bestStreak,
        feedback: `Time's up! The word was ${currentWord.word}.`,
        targetWord: currentWord.word,
        rawInput: "",
        normalizedInput: "",
        isVoice: false,
      },
      streak: 0,
    });
  },

  nextWord: () => {
    set({ phase: "playing" });
    get().startNewRound();
  },

  restartGame: () => {
    usedWordsSet.clear();
    masteredWordsSet.clear();
    set({
      score: 0,
      streak: 0,
      bestStreak: 0,
      masteredCount: 0,
      masteredWords: [],
      currentWord: null,
      sessionWords: [],
      sessionIndex: 0,
      difficultyEvolution: [],
      recentPerformance: [],
      roundsPlayed: 0,
      correctAnswers: 0,
      sessionStartTime: null,
      sessionBestStreak: 0,
      phase: "idle",
      result: null,
    });
  },

  toggleMastery: (word: string, shouldMaster: boolean) => {
    if (shouldMaster) {
      masteredWordsSet.add(word);
      set((state) => ({
        masteredWords: [...new Set([...state.masteredWords, word])],
      }));
    } else {
      masteredWordsSet.delete(word);
      set((state) => ({
        masteredWords: state.masteredWords.filter((w) => w !== word),
      }));
    }
  },

  setGradeLevel: (grade) => {
    set({ gradeLevel: grade });
    usedWordsSet.clear();
  },
  setDifficulty: (diff) => {
    set({ difficulty: diff });
    usedWordsSet.clear();
  },
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setMuted: (muted) => set({ isMuted: muted }),
  toggleLetterCount: () =>
    set((state) => ({ showLetterCount: !state.showLetterCount })),
  toggleAutoListen: () => set((state) => ({ autoListen: !state.autoListen })),
  setVoiceQuality: (q) => set({ voiceQuality: q }),
  setListeningTimeout: (t) => set({ listeningTimeout: t }),
  setAutoSubmit: (autoSubmit) => set({ autoSubmit }),

  loadProgress: async () => {
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        set({ userId: data.user.id });
      }
    }

    const uid = get().userId;
    if (!uid) return;

    const local = await localDb.progress.where("uid").equals(uid).first();
    if (local) {
      set({
        score: local.score,
        streak: local.streak,
        bestStreak: local.bestStreak,
        masteredCount: local.masteredCount,
      });
    }

    // Sync mastered words from Dexie if available
    masteredWordsSet.clear();
  },

  sessionStats: () => {
    const {
      roundsPlayed,
      correctAnswers,
      score,
      sessionStartTime,
      sessionBestStreak,
    } = get();
    const baselineRounds = 0;
    const baselineCorrect = 0;
    const baselineScore = 0;

    const sessionRounds = Math.max(roundsPlayed - baselineRounds, 0);
    const sessionCorrect = Math.max(correctAnswers - baselineCorrect, 0);
    const sessionScore = score - baselineScore;
    const sessionAccuracy =
      sessionRounds > 0
        ? Math.round((sessionCorrect / sessionRounds) * 100)
        : 0;
    const sessionDurationMinutes = sessionStartTime
      ? Math.max(1, Math.round((Date.now() - sessionStartTime) / 60000))
      : 0;

    return [
      { label: "Rounds", value: sessionRounds },
      { label: "Accuracy", value: `${sessionAccuracy}%` },
      { label: "Best streak", value: sessionBestStreak },
      {
        label: "Score change",
        value: sessionScore >= 0 ? `+${sessionScore}` : `${sessionScore}`,
      },
      {
        label: "Time played",
        value: sessionDurationMinutes > 0 ? `${sessionDurationMinutes}m` : "—",
      },
    ];
  },
}));
