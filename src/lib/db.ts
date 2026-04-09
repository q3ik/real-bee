import Dexie, { type Table } from "dexie";
import { DB_NAME, DB_SCHEMAS } from "../constants/database";

export interface LocalUserPreferences {
  id?: number;
  uid: string;
  difficulty: string;
  gradeLevel: string;
  soundEnabled: boolean;
  autoSubmit: boolean;
  showWelcomeScreen: boolean;
  dontShowWelcomeAgain: boolean;
}

export interface LocalUserProgress {
  uid: string; // primary key — one row per user
  score: number;
  streak: number;
  bestStreak: number;
  masteredCount: number;
  gradeLevel: string;
  difficulty: string;
  lastPlayed: string;
  synced: boolean;
}

export interface LocalSession {
  id?: number;
  uid: string;
  startTime: string;
  endTime?: string;
  wordsSpelled: number;
  correctCount: number;
  difficultyEvolution: number[];
  synced: boolean;
}

export class RealBeeDatabase extends Dexie {
  preferences!: Table<LocalUserPreferences>;
  progress!: Table<LocalUserProgress>;
  sessions!: Table<LocalSession>;

  constructor() {
    super(DB_NAME);
    this.version(2).stores({
      preferences: "++id, uid",
      progress: "++id, uid, synced",
      sessions: "++id, uid, synced",
    });
    // v3: make uid the primary key for progress so put() upserts correctly.
    // The old ++id rows are stale (every submitAnswer inserted a new row),
    // so dropping and recreating the table is safe.
    this.version(3).stores(DB_SCHEMAS);
  }
}

export const localDb = new RealBeeDatabase();
