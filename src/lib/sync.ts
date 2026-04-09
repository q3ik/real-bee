/**
 * Sync queue — manages offline-first sync of local data to the cloud.
 *
 * Uses Dexie's `synced` flag on progress and session records to track
 * which items need to be uploaded. When the user signs in (or comes
 * back online), `syncPending()` uploads all unsynced records that
 * belong to the currently authenticated user.
 *
 * Retry logic: exponential backoff with jitter, max 5 attempts per item.
 */

import { supabase } from "./supabase";
import {
  saveGameProgress,
  loadGameProgress,
  getUnsyncedProgress,
  markProgressSynced,
  getUnsyncedSessions,
  saveSession,
  markSessionsSynced,
} from "../game-engine/storage";
import type { LocalUserProgress, LocalSession } from "./db";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SYNC_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 1000;
const JITTER_RANGE_MS = 500;

// ---------------------------------------------------------------------------
// Retry queue (in-memory, survives page navigations via localStorage)
// ---------------------------------------------------------------------------

interface RetryEntry {
  uid: string;
  retryCount: number;
  lastAttempt: number;
}

const RETRY_STORAGE_KEY = "real-bee-sync-retries";

function loadRetryQueue(): Map<string, RetryEntry> {
  try {
    const raw = localStorage.getItem(RETRY_STORAGE_KEY);
    if (!raw) return new Map();
    const entries: RetryEntry[] = JSON.parse(raw);
    return new Map(entries.map((e) => [e.uid, e]));
  } catch {
    return new Map();
  }
}

function saveRetryQueue(queue: Map<string, RetryEntry>): void {
  try {
    localStorage.setItem(
      RETRY_STORAGE_KEY,
      JSON.stringify([...queue.values()]),
    );
  } catch {
    // localStorage full — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Sync logic
// ---------------------------------------------------------------------------

/**
 * Upload a single progress record to Supabase.
 *
 * Uses an upsert pattern: if a row exists for this user_id, it is replaced.
 */
async function uploadProgressToSupabase(
  progress: LocalUserProgress,
): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase.from("user_progress").upsert(
    {
      id: progress.uid,
      user_id: progress.uid,
      type: "progress",
      data: JSON.stringify({
        score: progress.score,
        streak: progress.streak,
        bestStreak: progress.bestStreak,
        masteredCount: progress.masteredCount,
        gradeLevel: progress.gradeLevel,
        difficulty: progress.difficulty,
      }),
      timestamp: progress.lastPlayed,
    },
    { onConflict: "id" },
  );

  if (error) {
    console.warn(
      "[sync] Failed to upload progress for",
      progress.uid,
      error.message,
    );
    return false;
  }

  return true;
}

/**
 * Calculate delay with exponential backoff and jitter.
 */
function getRetryDelay(retryCount: number): number {
  const base = BASE_RETRY_DELAY_MS * 2 ** retryCount;
  const jitter = Math.random() * JITTER_RANGE_MS;
  return Math.min(base + jitter, 30000); // Cap at 30s
}

/**
 * Sync all pending progress records to Supabase.
 *
 * Only records whose uid matches the authenticated user are uploaded;
 * offline-UID rows are skipped to prevent failed upserts.
 *
 * @returns Number of successfully synced records.
 */
export async function syncPending(): Promise<number> {
  if (!supabase) return 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const authedUid = user.id;

  const allUnsynced = await getUnsyncedProgress();
  // Only attempt to upload records that belong to the authenticated user.
  // Rows written under an offline-* UID are intentionally excluded here;
  // they can be migrated separately if needed.
  const unsynced = allUnsynced.filter((record) => record.uid === authedUid);
  if (unsynced.length === 0) return 0;

  const retryQueue = loadRetryQueue();
  let syncedCount = 0;

  for (const record of unsynced) {
    const retry = retryQueue.get(record.uid);

    // Skip if max retries exceeded
    if (retry && retry.retryCount >= MAX_SYNC_RETRIES) {
      console.warn("[sync] Max retries exceeded for", record.uid, "— skipping");
      continue;
    }

    // Skip if still in backoff window
    if (
      retry &&
      Date.now() - retry.lastAttempt < getRetryDelay(retry.retryCount)
    ) {
      continue;
    }

    const success = await uploadProgressToSupabase(record);

    if (success) {
      await markProgressSynced([record.uid]);
      retryQueue.delete(record.uid);
      syncedCount++;
    } else {
      retryQueue.set(record.uid, {
        uid: record.uid,
        retryCount: (retry?.retryCount ?? 0) + 1,
        lastAttempt: Date.now(),
      });
    }
  }

  saveRetryQueue(retryQueue);
  return syncedCount;
}

/**
 * Save progress locally and queue for cloud sync.
 *
 * This is the primary write path — always succeeds locally, queues sync
 * for later when online + authenticated.
 */
export async function saveProgressAndQueue(
  progress: LocalUserProgress,
): Promise<void> {
  await saveGameProgress(progress);
  // Sync will be triggered by the next `syncPending()` call (e.g. on sign-in)
}

/**
 * Save a session locally and queue for cloud sync.
 */
export async function saveSessionAndQueue(
  session: Omit<LocalSession, "id" | "synced">,
): Promise<number> {
  const id = await saveSession({
    uid: session.uid,
    startTime: session.startTime,
    endTime: session.endTime,
    wordsSpelled: session.wordsSpelled,
    correctCount: session.correctCount,
    difficultyEvolution: session.difficultyEvolution,
    synced: false,
  });
  return id;
}

/**
 * Load the latest progress for a user, falling back to local if
 * Supabase fetch fails.
 */
export async function loadProgressWithFallback(uid: string) {
  // Try local first (fast, always available)
  const local = await loadGameProgress(uid);

  // Try cloud in background
  if (supabase) {
    const { data, error } = await supabase
      .from("user_progress")
      .select("*")
      .eq("user_id", uid)
      .eq("type", "progress")
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      try {
        const parsed = JSON.parse(data.data as string) as Record<
          string,
          unknown
        >;
        const cloudProgress: LocalUserProgress = {
          uid,
          score: (parsed.score as number) ?? 0,
          streak: (parsed.streak as number) ?? 0,
          bestStreak: (parsed.bestStreak as number) ?? 0,
          masteredCount: (parsed.masteredCount as number) ?? 0,
          gradeLevel: (parsed.gradeLevel as string) ?? "all",
          difficulty: (parsed.difficulty as string) ?? "all",
          lastPlayed: data.timestamp,
          synced: true,
        };
        // Merge cloud data into local DB
        await saveGameProgress(cloudProgress);
        return cloudProgress;
      } catch {
        // Parse error — fall back to local
      }
    }
  }

  return local;
}
