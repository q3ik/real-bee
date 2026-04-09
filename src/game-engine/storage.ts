/**
 * Storage module — clean API wrapping Dexie for all local persistence.
 *
 * Replaces inline `localDb` calls in useGameStore with a typed, testable interface.
 *
 * Object stores (Dexie v3):
 *   - `preferences`: user settings (keyed by `uid`)
 *   - `progress`: game progress (keyed by `uid`, single row per user)
 *   - `sessions`: completed sessions (auto-increment id)
 */

import {
  localDb,
  type LocalUserProgress,
  type LocalSession,
  type LocalUserPreferences,
} from "../lib/db";

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/**
 * Save or update the user's game progress (upsert by uid).
 */
export async function saveGameProgress(
  progress: LocalUserProgress,
): Promise<void> {
  await localDb.progress.put(progress);
}

/**
 * Load game progress for a specific user ID.
 * Returns `null` if no progress exists for the given uid.
 */
export async function loadGameProgress(
  uid: string,
): Promise<LocalUserProgress | null> {
  const row = await localDb.progress.get(uid);
  return row ?? null;
}

/**
 * Clear game progress for a specific user.
 */
export async function clearGameProgress(uid: string): Promise<void> {
  await localDb.progress.delete(uid);
}

/**
 * Get all progress records that haven't been synced to the cloud yet.
 */
export async function getUnsyncedProgress(): Promise<LocalUserProgress[]> {
  return localDb.progress.where({ synced: false }).toArray();
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * Save a new game session. Returns the generated id.
 */
export async function saveSession(
  session: Omit<LocalSession, "id">,
): Promise<number> {
  const id = await localDb.sessions.add(session as LocalSession);
  return id as number;
}

/**
 * Load all sessions for a specific user.
 */
export async function loadUserSessions(uid: string): Promise<LocalSession[]> {
  return localDb.sessions.where("uid").equals(uid).toArray();
}

/**
 * Get all sessions that haven't been synced to the cloud yet.
 */
export async function getUnsyncedSessions(): Promise<LocalSession[]> {
  return localDb.sessions.where({ synced: false }).toArray();
}

/**
 * Mark sessions as synced by their ids.
 */
export async function markSessionsSynced(ids: number[]): Promise<void> {
  for (const id of ids) {
    await localDb.sessions.update(id, { synced: true });
  }
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

/**
 * Save or update user preferences (upsert by uid).
 */
export async function saveUserPreferences(
  prefs: LocalUserPreferences,
): Promise<void> {
  const existing = await localDb.preferences
    .where("uid")
    .equals(prefs.uid)
    .first();
  if (existing && existing.id !== undefined) {
    await localDb.preferences.update(existing.id, prefs);
  } else {
    await localDb.preferences.add(prefs);
  }
}

/**
 * Load user preferences by uid.
 * Returns `null` if no preferences exist for the given uid.
 */
export async function loadUserPreferences(
  uid: string,
): Promise<LocalUserPreferences | null> {
  const row = await localDb.preferences.where("uid").equals(uid).first();
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

/**
 * Mark progress records as synced by their uids.
 */
export async function markProgressSynced(uids: string[]): Promise<void> {
  for (const uid of uids) {
    const existing = await localDb.progress.get(uid);
    if (existing) {
      await localDb.progress.update(uid, { synced: true });
    }
  }
}

/**
 * Clear all local data for a specific user.
 */
export async function clearUserData(uid: string): Promise<void> {
  await Promise.all([
    localDb.progress.delete(uid),
    localDb.sessions.where("uid").equals(uid).delete(),
    localDb.preferences.where("uid").equals(uid).delete(),
  ]);
}
