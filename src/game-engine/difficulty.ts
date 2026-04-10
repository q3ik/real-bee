import type { Word } from '../types';

export type GameDifficulty = 'easy' | 'medium' | 'hard' | 'all';

/**
 * Adjusts difficulty based on recent performance history.
 * Returns a weighted random difficulty that adapts to player skill.
 *
 * @param currentDifficulty - The player's currently selected difficulty
 * @param recentPerformance - Array of booleans (true = correct)
 * @returns Adjusted difficulty string
 */
export function getAdjustedDifficulty(
  currentDifficulty: GameDifficulty,
  recentPerformance: boolean[],
): GameDifficulty {
  // Need at least 5 data points to make an informed decision
  if (!recentPerformance || recentPerformance.length < 5) {
    return currentDifficulty;
  }

  // Only auto-adjust when player has selected "all" (mixed)
  if (currentDifficulty !== 'all') {
    return currentDifficulty;
  }

  const recentAccuracy =
    recentPerformance.filter((result) => result).length / recentPerformance.length;

  const rand = Math.random();

  if (recentAccuracy > 0.75) {
    // Doing well — bias toward harder
    if (rand < 0.5) return 'hard';
    if (rand < 0.8) return 'medium';
    return 'easy';
  }

  if (recentAccuracy < 0.4) {
    // Struggling — bias toward easier
    if (rand < 0.5) return 'easy';
    if (rand < 0.8) return 'medium';
    return 'hard';
  }

  // Average performance — balanced distribution
  if (rand < 0.33) return 'easy';
  if (rand < 0.66) return 'medium';
  return 'hard';
}

export interface AvailableWordsResult {
  availableWords: Word[];
  shouldResetUsed: boolean;
  fallbackReason: 'grade_level' | 'difficulty' | 'all' | null;
}

/**
 * Returns available words filtered by difficulty and grade,
 * excluding recently used and mastered words.
 *
 * The 10% mastered re-allowance is applied only in the empty-pool fallback
 * path so that the primary filter is deterministic (important for tests and
 * for preventing mastered words from unexpectedly surfacing mid-session).
 */
export function getAvailableWords(
  words: Word[],
  difficulty: GameDifficulty,
  usedWords: Set<string>,
  masteredWords: Set<string>,
  gradeLevel: string,
): AvailableWordsResult {
  const wordList = Array.isArray(words) ? words : [];
  const usedSet = usedWords instanceof Set ? usedWords : new Set(usedWords);
  const masteredSet = masteredWords instanceof Set ? masteredWords : new Set(masteredWords);

  const matchesDifficulty = (word: Word): boolean => {
    return difficulty === 'all' || !word.difficulty || word.difficulty === difficulty;
  };

  const matchesGrade = (word: Word): boolean => {
    if (gradeLevel === 'all') return true;
    if (!word.grade) return true;
    return word.grade.toString() === gradeLevel;
  };

  const basePool = wordList.filter(
    (word) => matchesDifficulty(word) && matchesGrade(word),
  );

  // Primary filter: always exclude mastered and used words.
  // The 10% re-allowance for mastered words is intentionally deferred to the
  // empty-pool fallback below so this path is fully deterministic.
  const availableWords = basePool.filter((word) => {
    if (!word.word) return false;
    if (masteredSet.has(word.word)) return false;
    return !usedSet.has(word.word);
  });

  if (availableWords.length === 0) {
    // Pool exhausted — allow a 10% chance to surface mastered words so the
    // player isn't permanently blocked after mastering everything.
    const allowMastered = Math.random() < 0.1;
    const resetPool = basePool.filter(
      (word) => word.word && (allowMastered || !masteredSet.has(word.word)),
    );
    const fallbackReason = basePool.length === 0 ? 'all' : null;
    return { availableWords: resetPool, shouldResetUsed: true, fallbackReason };
  }

  return { availableWords, shouldResetUsed: false, fallbackReason: null };
}

/**
 * Selects a random word from the given array.
 */
export function selectRandomWord(words: Word[]): Word | null {
  if (!Array.isArray(words) || words.length === 0) return null;
  return words[Math.floor(Math.random() * words.length)];
}
