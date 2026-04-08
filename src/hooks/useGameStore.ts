import { create } from 'zustand';
import { type Word, getWordsForConfig } from '../lib/wordList';
import { localDb } from '../lib/db';
import { supabase } from '../lib/supabase';

const OFFLINE_UID_KEY = 'real-bee-offline-uid';

/** Returns a stable offline user ID, generating and persisting one on first call. */
function getOrCreateOfflineUid(): string {
  try {
    const existing = localStorage.getItem(OFFLINE_UID_KEY);
    if (existing) return existing;
    const uid = `offline-${crypto.randomUUID()}`;
    localStorage.setItem(OFFLINE_UID_KEY, uid);
    return uid;
  } catch {
    // localStorage unavailable (SSR, private-browsing lockdown, etc.)
    return 'offline-fallback';
  }
}

interface GameState {
  score: number;
  streak: number;
  bestStreak: number;
  masteredCount: number;
  currentWord: Word | null;
  gradeLevel: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'all';
  isMuted: boolean;
  voiceQuality: 'natural' | 'standard';
  listeningTimeout: 'normal' | 'longer' | 'off';
  showLetterCount: boolean;
  autoListen: boolean;
  sessionWords: Word[];
  sessionIndex: number;
  difficultyEvolution: number[];
  userId: string | null;

  setGradeLevel: (grade: number) => void;
  setDifficulty: (diff: 'easy' | 'medium' | 'hard' | 'all') => void;
  startSession: () => void;
  submitAnswer: (answer: string) => boolean;
  nextWord: () => void;
  toggleMute: () => void;
  toggleLetterCount: () => void;
  toggleAutoListen: () => void;
  setVoiceQuality: (q: 'natural' | 'standard') => void;
  setListeningTimeout: (t: 'normal' | 'longer' | 'off') => void;
  loadProgress: () => Promise<void>;
}

export const useGameStore = create<GameState>((set, get) => ({
  score: 0,
  streak: 0,
  bestStreak: 0,
  masteredCount: 0,
  currentWord: null,
  gradeLevel: 1,
  difficulty: 'easy',
  isMuted: false,
  showLetterCount: true,
  autoListen: false,
  voiceQuality: 'natural',
  listeningTimeout: 'normal',
  sessionWords: [],
  sessionIndex: 0,
  difficultyEvolution: [],
  userId: null,

  setGradeLevel: (grade) => set({ gradeLevel: grade }),
  setDifficulty: (diff) => set({ difficulty: diff }),

  startSession: () => {
    const { gradeLevel, difficulty } = get();
    const words = getWordsForConfig(gradeLevel, difficulty);
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    set({
      sessionWords: shuffled,
      sessionIndex: 0,
      currentWord: shuffled[0],
      difficultyEvolution: [],
    });
  },

  submitAnswer: (answer) => {
    const { currentWord, streak, score, bestStreak, masteredCount, difficultyEvolution, userId } = get();
    if (!currentWord) return false;

    const isCorrect =
      answer.toLowerCase().replace(/\s/g, '') === currentWord.word.toLowerCase();

    if (isCorrect) {
      const newStreak = streak + 1;
      const newScore = score + 10 * newStreak;
      const newBest = Math.max(bestStreak, newStreak);
      const newMastered = masteredCount + 1;

      set({
        score: newScore,
        streak: newStreak,
        bestStreak: newBest,
        masteredCount: newMastered,
        difficultyEvolution: [...difficultyEvolution, 1],
      });

      if (userId) {
        localDb.progress.put({
          uid: userId,
          score: newScore,
          streak: newStreak,
          bestStreak: newBest,
          masteredCount: newMastered,
          gradeLevel: get().gradeLevel.toString(),
          difficulty: get().difficulty,
          lastPlayed: new Date().toISOString(),
          synced: false,
        });
      } else {
        // loadProgress() wasn't called yet — persist under the offline UID
        // so no progress is silently dropped.
        const offlineUid = getOrCreateOfflineUid();
        set({ userId: offlineUid });
        localDb.progress.put({
          uid: offlineUid,
          score: newScore,
          streak: newStreak,
          bestStreak: newBest,
          masteredCount: newMastered,
          gradeLevel: get().gradeLevel.toString(),
          difficulty: get().difficulty,
          lastPlayed: new Date().toISOString(),
          synced: false,
        });
      }
    } else {
      set({
        streak: 0,
        difficultyEvolution: [...difficultyEvolution, -1],
      });
    }

    return isCorrect;
  },

  nextWord: () => {
    const { sessionWords, sessionIndex } = get();
    const nextIndex = sessionIndex + 1;
    if (nextIndex < sessionWords.length) {
      set({ sessionIndex: nextIndex, currentWord: sessionWords[nextIndex] });
    } else {
      set({ currentWord: null });
    }
  },

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleLetterCount: () => set((state) => ({ showLetterCount: !state.showLetterCount })),
  toggleAutoListen: () => set((state) => ({ autoListen: !state.autoListen })),
  setVoiceQuality: (q) => set({ voiceQuality: q }),
  setListeningTimeout: (t) => set({ listeningTimeout: t }),

  loadProgress: async () => {
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        set({ userId: data.user.id });
      }
    }

    // Fall back to a stable offline UID so progress is always persisted,
    // even when the user hasn't signed in yet.
    if (!get().userId) {
      set({ userId: getOrCreateOfflineUid() });
    }

    const uid = get().userId!;
    const local = await localDb.progress.where('uid').equals(uid).first();
    if (local) {
      set({
        score: local.score,
        streak: local.streak,
        bestStreak: local.bestStreak,
        masteredCount: local.masteredCount,
      });
    }
  },
}));
