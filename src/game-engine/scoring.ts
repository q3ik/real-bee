// Difficulty multipliers for scoring
export type Difficulty = 'easy' | 'medium' | 'hard';

interface DifficultyMultipliers {
  easy: number;
  medium: number;
  hard: number;
}

export const DIFFICULTY_MULTIPLIERS: DifficultyMultipliers = {
  easy: 1,
  medium: 2,
  hard: 3,
};

export const BASE_POINTS = 10;

/**
 * Calculate points for a correct answer.
 * Points = BASE_POINTS × difficultyMultiplier × (streak + 1)
 */
export function calculatePoints(difficulty: Difficulty, currentStreak: number): number {
  const multiplier = DIFFICULTY_MULTIPLIERS[difficulty] || 1;
  return BASE_POINTS * multiplier * (currentStreak + 1);
}

export interface ProcessSpellingSubmissionParams {
  normalized: string;
  target: string;
  difficulty: Difficulty;
  currentStreak: number;
  currentScore: number;
  bestStreak: number;
}

export interface ProcessSpellingSubmissionResult {
  isCorrect: boolean;
  points: number;
  newStreak: number;
  newBestStreak: number;
  newScore: number;
  feedback: string;
}

/**
 * Process a spelling submission and return updated game state.
 */
export function processSpellingSubmission({
  normalized,
  target,
  difficulty,
  currentStreak,
  currentScore,
  bestStreak,
}: ProcessSpellingSubmissionParams): ProcessSpellingSubmissionResult {
  const isCorrect = normalized === target;

  let points = 0;
  let newStreak: number;
  let newBestStreak = bestStreak;
  let feedback: string;

  if (isCorrect) {
    points = calculatePoints(difficulty, currentStreak);
    newStreak = currentStreak + 1;
    if (newStreak > bestStreak) {
      newBestStreak = newStreak;
    }
    feedback = 'Correct! Well done!';
  } else {
    newStreak = 0;
    feedback = `Incorrect. The correct spelling is: ${target.split('').join(', ')}`;
  }

  return {
    isCorrect,
    points,
    newStreak,
    newBestStreak,
    newScore: currentScore + points,
    feedback,
  };
}
