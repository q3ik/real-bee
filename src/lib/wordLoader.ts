/**
 * Word loader — loads and caches word data from grade-level JSON assets.
 *
 * Word files live in /public/data/words/grade-{1-12}.json and are loaded
 * on demand with a memory cache to avoid repeated fetches.
 */

import type { Word, GameDifficulty } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw word record as stored in the grade JSON files. */
export interface RawWordRecord {
  word: string;
  definition: string;
  example: string;
  phonetic: string;
  syllables: string;
  difficulty: string;
  gradeLevel: string;
}

/** Grade word file structure. */
export interface GradeWordFile {
  grade: number;
  language: string;
  version: string;
  lastUpdated: string;
  wordCount: number;
  words: RawWordRecord[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Valid grade numbers that have corresponding JSON files. */
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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a raw word record from the JSON file to the application Word type.
 */
export function mapRawWord(raw: RawWordRecord): Word {
  return {
    word: raw.word,
    definition: raw.definition,
    sentence: raw.example,
    syllables: raw.syllables,
    grade: parseGrade(raw.gradeLevel),
    difficulty: normalizeDifficulty(raw.difficulty),
  };
}

/**
 * Parse grade level string (e.g., "K-2", "3-5", "6-8") to the numeric
 * grade filter used by the game (1, 3, 6, or 0 for all).
 */
export function parseGrade(gradeLevel: string): number {
  const normalized = gradeLevel.trim().toLowerCase();
  if (normalized === "all" || normalized === "k-12") return 0;
  if (normalized === "k-2" || normalized === "k-3") return 1;
  if (
    normalized.startsWith("3") ||
    normalized.startsWith("4") ||
    normalized.startsWith("5")
  )
    return 3;
  if (
    normalized.startsWith("6") ||
    normalized.startsWith("7") ||
    normalized.startsWith("8")
  )
    return 6;
  // Fallback: try to extract a single digit
  const match = normalized.match(/^(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 2) return 1;
    if (num >= 3 && num <= 5) return 3;
    if (num >= 6 && num <= 8) return 6;
    if (num >= 9 && num <= 12) return num; // higher grades map to their number
  }
  return 0;
}

/** Normalize difficulty string to GameDifficulty type. */
export function normalizeDifficulty(diff: string): GameDifficulty {
  const normalized = diff.toLowerCase().trim();
  if (
    normalized === "easy" ||
    normalized === "medium" ||
    normalized === "hard" ||
    normalized === "all"
  ) {
    return normalized;
  }
  return "medium"; // safe default
}

/** Fetch and parse a single grade JSON file. */
async function fetchGradeWords(fileName: string): Promise<GradeWordFile> {
  const response = await fetch(`/data/words/${fileName}.json`);
  if (!response.ok) {
    throw new Error(
      `Failed to load word file: /data/words/${fileName}.json (${response.status})`,
    );
  }
  return response.json() as Promise<GradeWordFile>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load words for a specific grade level. Results are cached.
 *
 * @param grade - Grade number (1-12) or 0 for all grades
 * @returns Promise resolving to the filtered word list
 */
export async function loadWordsForGrade(grade: number): Promise<Word[]> {
  // Return cached if available
  if (wordCache.has(grade)) {
    return wordCache.get(grade)!;
  }

  let words: Word[] = [];

  if (grade === 0) {
    // Load all grade files
    const allPromises = VALID_GRADES.map(async (g) => {
      if (wordCache.has(g)) return wordCache.get(g)!;
      const fileName = GRADE_FILE_MAP[g];
      const data = await fetchGradeWords(fileName);
      const gradeWords = data.words.map(mapRawWord);
      wordCache.set(g, gradeWords);
      return gradeWords;
    });

    const results = await Promise.all(allPromises);
    words = results.flat();
    allGradesLoaded = true;
  } else {
    const fileName = GRADE_FILE_MAP[grade];
    if (!fileName) {
      throw new Error(`No word file configured for grade ${grade}`);
    }
    const data = await fetchGradeWords(fileName);
    words = data.words.map(mapRawWord);
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
