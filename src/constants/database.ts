/**
 * Database configuration constants.
 * Extracted from db.ts (Dexie schema).
 */

/**
 * IndexedDB database name.
 */
export const DB_NAME = 'RealBeeDB';

/**
 * Current database schema version.
 */
export const DB_VERSION = 3;

/**
 * Schema definitions for Dexie tables.
 */
export const DB_SCHEMAS = {
  preferences: '++id, uid',
  progress: 'uid, synced',
  sessions: '++id, uid, synced',
} as const;
