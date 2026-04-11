/**
 * Word loader — loads and caches word data from grade-level JSON assets.
 *
 * Word files live in /public/data/words/grade-{1,3,6,9}.json and are loaded
 * on demand with a memory cache to avoid repeated fetches.
 *
 * Grade contract (range-based):
 *   grade 1  → grade-1.json  (K-2)
 *   grade 3  → grade-3.json  (3-5)
 *   grade 6  → grade-6.json  (6-8)
 *   grade 9  → grade-9.json  (9-12)
 *   grade 0  → all four files combined
 */

import type { Word, GameDifficulty, Grade } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * All grade buckets that the generator emits and the loader fetches.
 * Must stay in sync with generate-word-databases.js GRADE_LEVEL_MAP values.
 */
export const VALID_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Grade-to-file mapping. Grade 0 = "all grades" (loads every file). */
export const GRADE_FILE_MAP: Record<number, string> = {
  0: "all", // special: loads all files
  1: "grade-1",
  2: "grade-2",
  3: "grade-3",
  4: "grade-4",
  5: "grade-5",
  6: "grade-6",
  7: "grade-7",
  8: "grade-8",
  9: "grade-9",
  10: "grade-10",
  11: "grade-11",
  12: "grade-12",
};

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/** In-memory cache: grade number → loaded Word[] */
const wordCache = new Map<number, Word[]>();

/** Whether all grades have been loaded (grade 0). */
let allGradesLoaded = false;

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

/** Dedicated error class for word loading failures. */
export class WordLoaderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "WordLoaderError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch and parse a single grade JSON file. */
async function fetchGradeWords(
  fileName: string,
  signal?: AbortSignal,
): Promise<Word[]> {
  try {
    const response = await fetch(`/data/words/${fileName}.json`, { signal });
    if (!response.ok) {
      throw new WordLoaderError(
        `Failed to load word file: /data/words/${fileName}.json (${response.status})`,
      );
    }
    return response.json() as Promise<Word[]>;
  } catch (error) {
    if (error instanceof WordLoaderError) {
      throw error;
    }
    throw new WordLoaderError(`Failed to fetch word file: ${fileName}`, error);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load words for a specific grade level. Results are cached.
 *
 * @param grade - Grade bucket (1-12) or 0 for all grades
 * @param signal - Optional AbortSignal to cancel in-flight requests
 * @returns Promise resolving to the filtered word list
 */
export async function loadWordsForGrade(
  grade: number,
  signal?: AbortSignal,
): Promise<Word[]> {
  // Return cached if available
  if (wordCache.has(grade)) {
    return wordCache.get(grade)!;
  }

  let words: Word[] = [];

  if (grade === 0) {
    // Load only the four range files that the generator produces
    const allPromises = VALID_GRADES.map(async (g) => {
      if (wordCache.has(g)) return wordCache.get(g)!;
      const fileName = GRADE_FILE_MAP[g];
      const gradeWords = await fetchGradeWords(fileName, signal);
      wordCache.set(g, gradeWords);
      return gradeWords;
    });

    const results = await Promise.all(allPromises);
    words = results.flat();
    allGradesLoaded = true;
  } else {
    const fileName = GRADE_FILE_MAP[grade];
    if (!fileName) {
      throw new WordLoaderError(`No word file configured for grade ${grade}`);
    }
    words = await fetchGradeWords(fileName, signal);
  }

  wordCache.set(grade, words);
  return words;
}

/**
 * Get words for the game's current grade + difficulty config.
 * This is the main entry point used by useGameStore.
 */
export async function getWordsForConfigAsync(
  grade: number,
  difficulty: string,
): Promise<Word[]> {
  const words = await loadWordsForGrade(grade);

  return words.filter((w) => {
    const diffMatch = difficulty === "all" || w.difficulty === difficulty;
    return diffMatch;
  });
}

/**
 * Clear the word cache (useful for testing or refreshing data).
 */
export function clearWordCache(): void {
  wordCache.clear();
  allGradesLoaded = false;
}

/**
 * Check whether a grade's words are loaded in the cache.
 */
export function isGradeLoaded(grade: number): boolean {
  return wordCache.has(grade) || (grade === 0 && allGradesLoaded);
}

/**
 * Return the list of grade numbers currently held in the cache.
 * Useful for debugging and for inspecting warm-cache state in tests.
 */
export function getCachedGrades(): number[] {
  return Array.from(wordCache.keys());
}
