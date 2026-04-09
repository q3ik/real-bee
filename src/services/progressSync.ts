/**
 * Progress sync service — coordinates sync of local Dexie data to Supabase.
 *
 * Exposes:
 *   - `syncUserProgress(userId)` — one-time sync of all pending records
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
}

/**
 * Sync all pending user progress and sessions to the cloud.
 *
 * @param userId - The authenticated user's Supabase UID
 * @returns Sync summary
 */
export async function syncUserProgress(userId: string): Promise<SyncResult> {
  const progressBefore = await getUnsyncedProgress();
  const sessionsBefore = await getUnsyncedSessions();

  const progressSynced = await syncPending();

  // Sessions sync is a no-op for now — sessions are stored locally
  // and will be synced when a dedicated endpoint is added.
  const sessionsSynced = 0;

  const progressAfter = await getUnsyncedProgress();
  const sessionsAfter = await getUnsyncedSessions();

  return {
    progressSynced,
    sessionsSynced,
    totalPending: progressAfter.length + sessionsAfter.length,
  };
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
  return syncUserProgress(userId);
}
