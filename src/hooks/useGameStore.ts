import { create } from 'zustand';
import { type Word, getWordsForConfig } from '../lib/wordList';
import { localDb } from '../lib/db';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

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
  
  // Actions
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
      difficultyEvolution: []
    });
  },

  submitAnswer: (answer) => {
    const { currentWord, streak, score, bestStreak, masteredCount, difficultyEvolution } = get();
    if (!currentWord) return false;

    const isCorrect = answer.toLowerCase().replace(/\s/g, '') === currentWord.word.toLowerCase();
    
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
        difficultyEvolution: [...difficultyEvolution, 1] // 1 for correct
      });
      
      // Save to local DB
      const user = auth.currentUser;
      if (user) {
        localDb.progress.put({
          uid: user.uid,
          score: newScore,
          streak: newStreak,
          bestStreak: newBest,
          masteredCount: newMastered,
          gradeLevel: get().gradeLevel.toString(),
          difficulty: get().difficulty,
          lastPlayed: new Date().toISOString(),
          synced: false
        });
      }
    } else {
      set({ 
        streak: 0,
        difficultyEvolution: [...difficultyEvolution, -1] // -1 for incorrect
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
      // End session logic
      set({ currentWord: null });
    }
  },

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleLetterCount: () => set((state) => ({ showLetterCount: !state.showLetterCount })),
  toggleAutoListen: () => set((state) => ({ autoListen: !state.autoListen })),
  setVoiceQuality: (q) => set({ voiceQuality: q }),
  setListeningTimeout: (t) => set({ listeningTimeout: t }),

  loadProgress: async () => {
    const user = auth.currentUser;
    if (!user) return;

    // Try Firestore first
    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        set({
          score: data.score || 0,
          streak: data.streak || 0,
          bestStreak: data.bestStreak || 0,
          masteredCount: data.masteredCount || 0
        });
        return;
      }
    } catch (e) {
      console.error("Firestore load failed:", e);
    }

    // Fallback to local DB
    const local = await localDb.progress.where('uid').equals(user.uid).first();
    if (local) {
      set({
        score: local.score,
        streak: local.streak,
        bestStreak: local.bestStreak,
        masteredCount: local.masteredCount
      });
    }
  }
}));
