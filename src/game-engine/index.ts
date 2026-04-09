export {
  normalizeSpelling,
  isLikelyWholeWordAttempt,
  hasSpellingIndicators,
} from './normalization';

export {
  getAdjustedDifficulty,
  getAvailableWords,
  selectRandomWord,
} from './difficulty';

export type { GameDifficulty, AvailableWordsResult } from './difficulty';

export {
  calculatePoints,
  processSpellingSubmission,
  DIFFICULTY_MULTIPLIERS,
  BASE_POINTS,
} from './scoring';

export type {
  ProcessSpellingSubmissionParams,
  ProcessSpellingSubmissionResult,
} from './scoring';

export {
  SoundManager,
  soundManager,
  SOUND_FREQUENCIES,
} from './SoundManager';

export type { PlayAudioBufferOptions } from './SoundManager';
