import Dexie, { type Table } from 'dexie';

export interface LocalUserProgress {
  id?: number;
  uid: string;
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
  progress!: Table<LocalUserProgress>;
  sessions!: Table<LocalSession>;

  constructor() {
    super('RealBeeDB');
    this.version(1).stores({
      progress: '++id, uid, synced',
      sessions: '++id, uid, synced'
    });
  }
}

export const localDb = new RealBeeDatabase();
