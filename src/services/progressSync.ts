/**
 * Progress sync service — coordinates sync of local Dexie data to Supabase.
 *
 * Exposes:
 *   - `syncUserProgress()` — one-time sync of all pending records for the
 *     currently authenticated user (identity resolved inside syncPending())
 *   - `getPendingCount()` — number of unsynced records
 *   - `autoSyncOnSignIn(userId)` — triggers sync when user signs in
 *
 * Designed to be called from the AuthContext or App component on auth state changes.
 */

import { syncPending } from '../lib/sync';
import { getUnsyncedProgress, getUnsyncedSessions } from '../game-engine/storage';

export interface SyncResult {
  progressSynced: number;
  sessionsSynced: number;
  totalPending: number;
  error?: unknown;
}

/**
 * Sync all pending user progress and sessions to the cloud.
 *
 * The authenticated user identity is derived from the active Supabase
 * session inside `syncPending()` — no userId parameter is needed here.
 *
 * @returns Sync summary
 */
export async function syncUserProgress(): Promise<SyncResult> {
  try {
    const progressSynced = await syncPending();

    // Sessions sync is a no-op for now — sessions are stored locally
    // and will be synced when a dedicated endpoint is added.
    const sessionsSynced = 0;

    const [progressAfter, sessionsAfter] = await Promise.all([
      getUnsyncedProgress(),
      getUnsyncedSessions(),
    ]);

    return {
      progressSynced,
      sessionsSynced,
      totalPending: progressAfter.length + sessionsAfter.length,
    };
  } catch (err) {
    console.warn('[progressSync] syncUserProgress failed:', err);
    return { progressSynced: 0, sessionsSynced: 0, totalPending: 0, error: err };
  }
}

/**
 * Get the total number of unsynced records (progress + sessions).
 */
export async function getPendingCount(): Promise<number> {
  const [progress, sessions] = await Promise.all([
    getUnsyncedProgress(),
    getUnsyncedSessions(),
  ]);
  return progress.length + sessions.length;
}

/**
 * Trigger sync when the user signs in.
 * Returns null if no user is authenticated.
 */
export async function autoSyncOnSignIn(userId: string | null): Promise<SyncResult | null> {
  if (!userId) return null;
  return syncUserProgress();
}
