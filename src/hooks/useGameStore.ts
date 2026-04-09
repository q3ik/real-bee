import { create } from "zustand";
import { type Word, getWordsForConfig } from "../lib/wordList";
import { localDb } from "../lib/db";
import { supabase } from "../lib/supabase";
import type {
  GamePhase,
  GameDifficulty,
  GameResult,
  SessionStat,
} from "../types";
export type {
  GamePhase,
  GameDifficulty,
  GameResult,
  SessionStat,
} from "../types";
import { RECENT_PERFORMANCE_WINDOW, OFFLINE_UID_KEY } from "../constants/game";
import {
  normalizeSpelling,
  isLikelyWholeWordAttempt,
} from "../game-engine/normalization";
import {
  processSpellingSubmission,
  type Difficulty as ScoringDifficulty,
} from "../game-engine/scoring";
import {
  getAvailableWords,
  selectRandomWord,
  getAdjustedDifficulty,
} from "../game-engine/difficulty";

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

/** Returns a stable offline user ID, generating and persisting one on first call. */
function getOrCreateOfflineUid(): string {
  try {
    const existing = localStorage.getItem(OFFLINE_UID_KEY);
    if (existing) return existing;
    const uid = `offline-${crypto.randomUUID()}`;
    localStorage.setItem(OFFLINE_UID_KEY, uid);
    return uid;
  } catch {
    return "offline-fallback";
  }
}

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
  /**
   * Submit an answer for the current round.
   * Returns:
   *   true  — answer was correct
   *   false — answer was incorrect (round recorded)
   *   null  — submission was invalid (empty after normalization); round NOT advanced
   */
  submitAnswer: (answer: string, isVoice?: boolean) => boolean | null;
  timeoutRound: () => void;

  // --- Actions: Mastery ---
  toggleMastery: (word: string, shouldMaster: boolean) => void;

  // --- Actions: Auth ---
  /** Set or clear the authenticated user ID. Pass null to reset to offline identity. */
  setUserId: (uid: string | null) => void;

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
// NOTE: masteredWordsSet is intentionally NOT used as a persistent module-level
// source of truth — it is rebuilt from state.masteredWords on every call to
// startNewRound() to prevent desync after startSession/loadProgress clears it.

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
    // masteredWordsSet is NOT cleared here — startNewRound() always rebuilds
    // it fresh from state.masteredWords so there is no stale-Set risk.
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
      sessionWords,
      sessionIndex,
      recentPerformance,
      masteredWords,
    } = get();

    if (!get().sessionStartTime) {
      set({ sessionStartTime: Date.now(), sessionBestStreak: 0 });
    }

    let pool = sessionWords;
    if (pool.length === 0 || sessionIndex >= pool.length) {
      pool = getWordsForConfig(gradeLevel, difficulty);
      pool = [...pool].sort(() => Math.random() - 0.5);
    }

    // Rebuild masteredWordsSet from authoritative Zustand state on every call.
    // This prevents desync when startSession() or loadProgress() ran between
    // rounds without explicitly updating the old module-level Set.
    const masteredWordsSet = new Set<string>(masteredWords);

    // Use game-engine difficulty filtering with mastered-word re-allowance
    const gradeLevelStr = gradeLevel === 0 ? "all" : gradeLevel.toString();
    const { availableWords, shouldResetUsed, fallbackReason } =
      getAvailableWords(
        pool,
        difficulty,
        usedWordsSet,
        masteredWordsSet,
        gradeLevelStr,
      );

    if (shouldResetUsed) {
      usedWordsSet.clear();
    }

    if (fallbackReason) {
      console.warn(`[useGameStore] Word pool fallback: ${fallbackReason}`);
    }

    // Use game-engine random selection
    const word = selectRandomWord(availableWords);
    if (!word) {
      set({
        phase: "idle",
        currentWord: null,
        sessionWords: [],
        sessionIndex: 0,
      });
      return;
    }

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
      difficultyEvolution,
      masteredWords,
    } = get();
    if (!currentWord || phase !== "playing") return null;

    // Use game-engine normalization (handles NATO phonetic alphabet, digit stripping, filler words)
    const normalized = normalizeSpelling(answer);

    // Return null (not false) for invalid/empty input so callers can distinguish
    // "invalid submission" from "genuine incorrect answer" and avoid advancing
    // the round or penalising the streak on noise/empty voice input.
    if (!normalized) return null;

    // Map 'all' difficulty to 'medium' for scoring (scoring module expects easy/medium/hard)
    const scoringDifficulty: ScoringDifficulty =
      difficulty === "all" ? "medium" : difficulty;

    // Use game-engine scoring (difficulty multipliers, streak-based points)
    const submissionResult = processSpellingSubmission({
      normalized,
      target: currentWord.word.toLowerCase(),
      difficulty: scoringDifficulty,
      currentStreak: streak,
      currentScore: score,
      bestStreak,
    });

    const evolutionEntry = submissionResult.isCorrect ? 1 : -1;

    // Resolve the uid to write progress under (prefer authenticated, fall back to offline)
    const effectiveUid =
      userId ??
      (() => {
        const offlineUid = getOrCreateOfflineUid();
        set({ userId: offlineUid });
        return offlineUid;
      })();

    // Non-blocking Dexie write — fire-and-forget but with a rejection handler
    // so that storage failures (quota exceeded, private browsing, blocked DB)
    // surface as a warning rather than an unhandled promise rejection.
    void localDb.progress
      .put({
        uid: effectiveUid,
        score: submissionResult.newScore,
        streak: submissionResult.newStreak,
        bestStreak: submissionResult.newBestStreak,
        masteredCount:
          get().masteredCount + (submissionResult.isCorrect ? 1 : 0),
        gradeLevel: gradeLevel.toString(),
        difficulty,
        lastPlayed: new Date().toISOString(),
        synced: false,
      })
      .catch((err: unknown) => {
        console.warn(
          "[useGameStore] submitAnswer: failed to persist progress to IndexedDB",
          err,
        );
      });

    set({
      score: submissionResult.newScore,
      streak: submissionResult.newStreak,
      bestStreak: submissionResult.newBestStreak,
      masteredCount: get().masteredCount + (submissionResult.isCorrect ? 1 : 0),
      roundsPlayed: roundsPlayed + 1,
      correctAnswers: correctAnswers + (submissionResult.isCorrect ? 1 : 0),
      difficultyEvolution: [...difficultyEvolution, evolutionEntry],
      recentPerformance: [
        ...get().recentPerformance,
        submissionResult.isCorrect,
      ].slice(-RECENT_PERFORMANCE_WINDOW),
      sessionBestStreak: Math.max(
        get().sessionBestStreak,
        submissionResult.newStreak,
      ),
      phase: "round_end",
      result: {
        isCorrect: submissionResult.isCorrect,
        points: submissionResult.points,
        newScore: submissionResult.newScore,
        newStreak: submissionResult.newStreak,
        newBestStreak: submissionResult.newBestStreak,
        feedback: submissionResult.feedback,
        targetWord: currentWord.word,
        rawInput: answer,
        normalizedInput: normalized,
        isVoice,
      },
    });

    return submissionResult.isCorrect;
  },

  timeoutRound: () => {
    const { currentWord, phase, roundsPlayed } = get();
    if (!currentWord || phase !== "playing") return;

    set({
      roundsPlayed: roundsPlayed + 1,
      difficultyEvolution: [...get().difficultyEvolution, -1],
      recentPerformance: [...get().recentPerformance, false].slice(
        -RECENT_PERFORMANCE_WINDOW,
      ),
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
      set((state) => ({
        masteredWords: [...new Set([...state.masteredWords, word])],
      }));
    } else {
      set((state) => ({
        masteredWords: state.masteredWords.filter((w) => w !== word),
      }));
    }
    // No need to touch a module-level Set — startNewRound() rebuilds it from state
  },

  // --- Auth ---
  // Accepts null to clear the authenticated identity on sign-out so that
  // subsequent reads/writes fall back to the offline UID rather than
  // continuing to use a stale authenticated user's ID.
  setUserId: (uid) => set({ userId: uid }),

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
    // Resolve auth: prefer Supabase session, fall back to stable offline UID.
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        set({ userId: data.user.id });
      }
    }

    if (!get().userId) {
      set({ userId: getOrCreateOfflineUid() });
    }

    const uid = get().userId!;
    // uid is the primary key — get() is an O(1) lookup and always returns
    // the single canonical row (no stale duplicates possible).
    const local = await localDb.progress.get(uid);
    if (local) {
      set({
        score: local.score,
        streak: local.streak,
        bestStreak: local.bestStreak,
        masteredCount: local.masteredCount,
      });
    }
    // masteredWordsSet is NOT touched here — it is rebuilt per-round from
    // state.masteredWords so loadProgress() cannot desync it.
  },

  sessionStats: () => {
    const {
      roundsPlayed,
      correctAnswers,
      score,
      sessionStartTime,
      sessionBestStreak,
    } = get();

    const sessionAccuracy =
      roundsPlayed > 0 ? Math.round((correctAnswers / roundsPlayed) * 100) : 0;
    const sessionDurationMinutes = sessionStartTime
      ? Math.max(1, Math.round((Date.now() - sessionStartTime) / 60000))
      : 0;

    return [
      { label: "Rounds", value: roundsPlayed },
      { label: "Accuracy", value: `${sessionAccuracy}%` },
      { label: "Best streak", value: sessionBestStreak },
      { label: "Score", value: score },
      {
        label: "Time played",
        value: sessionDurationMinutes > 0 ? `${sessionDurationMinutes}m` : "—",
      },
    ];
  },
}));
