import { create } from "zustand";
import type { Word } from "../types";
import { getWordsForConfigAsync, loadWordsForGrade } from "../lib/wordLoader";
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
  /** Baseline captured at session start so stats reflect session-only deltas. */
  sessionBaseline: {
    score: number;
    roundsPlayed: number;
    correctAnswers: number;
  };
  /** True only when a played session has naturally completed. */
  sessionCompleted: boolean;

  // --- Used words (exposed for UI) ---
  usedWords: string[];

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
  startSession: () => Promise<void>;
  startNewRound: () => Promise<void>;
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
// masteredWordsSet is kept in sync with state.masteredWords in
// toggleMastery and loadProgress to prevent desync after restarts.
// startNewRound updates this set in-place from authoritative Zustand state
// on every call instead of shadowing it with a local const (QA fix #2).
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
  sessionBaseline: { score: 0, roundsPlayed: 0, correctAnswers: 0 },
  sessionCompleted: false,
  usedWords: [],

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

  startSession: async () => {
    usedWordsSet.clear();
    masteredWordsSet.clear();
    // Capture baseline so sessionStats reflects only this session's progress.
    const { score, roundsPlayed, correctAnswers } = get();
    set({
      score,
      streak: 0,
      roundsPlayed,
      correctAnswers,
      sessionStartTime: null,
      sessionBestStreak: 0,
      sessionBaseline: { score, roundsPlayed, correctAnswers },
      recentPerformance: [],
      difficultyEvolution: [],
      result: null,
      sessionCompleted: false,
      usedWords: [],
      masteredWords: [],
      masteredCount: 0,
    });
    await get().startNewRound();
  },

  startNewRound: async () => {
    const {
      gradeLevel,
      difficulty,
      sessionWords,
      sessionIndex,
      recentPerformance,
      masteredWords,
      roundsPlayed,
      sessionBaseline,
    } = get();

    if (!get().sessionStartTime) {
      set({ sessionStartTime: Date.now(), sessionBestStreak: 0 });
    }

    let pool = sessionWords;
    if (pool.length === 0 || sessionIndex >= pool.length) {
      // Load words asynchronously from the grade JSON files
      const words = await getWordsForConfigAsync(gradeLevel, difficulty);
      pool = [...words].sort(() => Math.random() - 0.5);
    }

    // Rebuild the module-level masteredWordsSet from authoritative Zustand state
    // on every call. Assigning in-place (clear + add) keeps the reference stable
    // so toggleMastery and restartGame still operate on the same set object.
    // Previously this was a shadowed local `const` which silently diverged (QA fix #2).
    masteredWordsSet.clear();
    for (const w of masteredWords) masteredWordsSet.add(w);

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
        usedWords: [...usedWordsSet],
        sessionCompleted: roundsPlayed > sessionBaseline.roundsPlayed,
      });
      return;
    }

    usedWordsSet.add(word.word);

    // Set currentWord and phase atomically so useGameState's phase-transition
    // effect always sees the new word when it observes phase === 'playing'.
    set({
      currentWord: word,
      sessionWords: pool,
      sessionIndex: sessionIndex + 1,
      phase: "playing",
      result: null,
      sessionCompleted: false,
      usedWords: [...usedWordsSet],
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
    // Do NOT eagerly set phase to 'playing' here. startNewRound() sets both
    // currentWord and phase atomically, so useGameState's phase-transition
    // effect will always see the new word when it observes phase === 'playing'.
    void get()
      .startNewRound()
      .catch((err: unknown) => {
        console.warn("[useGameStore] nextWord: startNewRound failed", err);
        set({ phase: "idle", currentWord: null, sessionCompleted: false });
      });
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
      sessionCompleted: false,
    });
  },

  toggleMastery: (word: string, shouldMaster: boolean) => {
    if (shouldMaster) {
      masteredWordsSet.add(word);
      set((state) => {
        const next = [...new Set([...state.masteredWords, word])];
        // Persist mastered words to localStorage (keyed by uid)
        try {
          const uid = get().userId;
          if (uid)
            localStorage.setItem(
              `real-bee-mastered-${uid}`,
              JSON.stringify(next),
            );
        } catch {
          /* ignore */
        }
        return { masteredWords: next, masteredCount: next.length };
      });
    } else {
      masteredWordsSet.delete(word);
      set((state) => {
        const next = state.masteredWords.filter((w) => w !== word);
        try {
          const uid = get().userId;
          if (uid)
            localStorage.setItem(
              `real-bee-mastered-${uid}`,
              JSON.stringify(next),
            );
        } catch {
          /* ignore */
        }
        return { masteredWords: next, masteredCount: next.length };
      });
    }
  },

  // --- Auth ---
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
    const local = await localDb.progress.get(uid);
    if (local) {
      set({
        score: local.score,
        streak: local.streak,
        bestStreak: local.bestStreak,
        masteredCount: local.masteredCount,
      });
    }

    // Load mastered words from localStorage (keyed by uid)
    masteredWordsSet.clear();
    try {
      const raw = localStorage.getItem(`real-bee-mastered-${uid}`);
      if (raw) {
        const words: string[] = JSON.parse(raw);
        for (const w of words) masteredWordsSet.add(w);
        set({ masteredWords: words, masteredCount: words.length });
      }
    } catch {
      // Ignore parse errors — start fresh
    }
  },

  sessionStats: () => {
    const {
      roundsPlayed,
      correctAnswers,
      score,
      sessionStartTime,
      sessionBestStreak,
      sessionBaseline,
    } = get();

    // Session-only deltas (subtract baseline captured at session start)
    const sessionRounds = Math.max(
      roundsPlayed - sessionBaseline.roundsPlayed,
      0,
    );
    const sessionCorrect = Math.max(
      correctAnswers - sessionBaseline.correctAnswers,
      0,
    );
    const sessionScore = score - sessionBaseline.score;
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
