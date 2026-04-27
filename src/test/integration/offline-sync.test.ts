/**
 * Integration Tests - Offline Sync Flow
 *
 * Tests the Dexie-based offline→online sync workflow using the real exported
 * API surface: syncUserProgress / getPendingCount (progressSync) and the
 * underlying syncPending / saveProgressAndQueue helpers (lib/sync).
 *
 * Supabase client and storage layer functions are mocked so these tests run
 * without a real database connection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LocalUserProgress } from "@/lib/db";

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------
const mockUpsert = vi.fn();
const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
  },
}));

// ---------------------------------------------------------------------------
// Mock Dexie storage layer
// ---------------------------------------------------------------------------
const mockGetUnsyncedProgress = vi.fn<() => Promise<LocalUserProgress[]>>();
const mockMarkProgressSynced = vi.fn<(uids: string[]) => Promise<void>>();
const mockGetUnsyncedSessions = vi.fn<() => Promise<unknown[]>>();
const mockSaveGameProgress = vi.fn<(p: LocalUserProgress) => Promise<void>>();

vi.mock("@/game-engine/storage", () => ({
  getUnsyncedProgress: mockGetUnsyncedProgress,
  markProgressSynced: mockMarkProgressSynced,
  getUnsyncedSessions: mockGetUnsyncedSessions,
  saveGameProgress: mockSaveGameProgress,
  loadGameProgress: vi.fn().mockResolvedValue(null),
  saveSession: vi.fn().mockResolvedValue(1),
  markSessionsSynced: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeProgress(uid: string, overrides?: Partial<LocalUserProgress>): LocalUserProgress {
  return {
    uid,
    score: 10,
    streak: 2,
    bestStreak: 5,
    masteredCount: 1,
    gradeLevel: "1",
    difficulty: "easy",
    lastPlayed: new Date().toISOString(),
    synced: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Integration: Offline Sync Flow", () => {
  beforeEach(() => {
    // vi.resetAllMocks() drains mockResolvedValueOnce queues in addition to
    // clearing call history. Using clearAllMocks() alone allows unconsumed
    // queued return values to bleed into the next test (QA fix #5 / #1).
    vi.resetAllMocks();

    // lib/sync.ts persists a retry queue to localStorage under
    // RETRY_STORAGE_KEY. Stale entries carry over between tests and cause
    // syncPending to skip records that are still within the backoff window,
    // making tests pass for the wrong reason (QA fix #2).
    localStorage.clear();
  });

  describe("getPendingCount", () => {
    it("returns zero when nothing is unsynced", async () => {
      mockGetUnsyncedProgress.mockResolvedValue([]);
      mockGetUnsyncedSessions.mockResolvedValue([]);

      const { getPendingCount } = await import("@/services/progressSync");
      const count = await getPendingCount();
      expect(count).toBe(0);
    });

    it("returns the total of unsynced progress rows + unsynced sessions", async () => {
      const uid = "user-abc";
      mockGetUnsyncedProgress.mockResolvedValue([
        makeProgress(uid),
        makeProgress("user-xyz"),
      ]);
      mockGetUnsyncedSessions.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);

      const { getPendingCount } = await import("@/services/progressSync");
      const count = await getPendingCount();
      expect(count).toBe(5);
    });
  });

  describe("syncUserProgress", () => {
    it("uploads unsynced rows for the authenticated user and marks them synced", async () => {
      const uid = "auth-user-1";
      mockGetUser.mockResolvedValue({ data: { user: { id: uid } }, error: null });
      mockUpsert.mockResolvedValue({ error: null });
      mockGetUnsyncedProgress
        // First call inside syncPending — returns one unsynced row
        .mockResolvedValueOnce([makeProgress(uid)])
        // Second call inside syncUserProgress (after sync) — empty
        .mockResolvedValue([]);
      mockMarkProgressSynced.mockResolvedValue(undefined);
      mockGetUnsyncedSessions.mockResolvedValue([]);

      const { syncUserProgress } = await import("@/services/progressSync");
      const result = await syncUserProgress();

      expect(mockUpsert).toHaveBeenCalledOnce();
      expect(mockMarkProgressSynced).toHaveBeenCalledWith([uid]);
      // getUnsyncedProgress must have been called exactly twice:
      // once inside syncPending and once inside syncUserProgress after sync.
      // If the call count changes this assertion will catch the ordering regression (QA fix #1).
      expect(mockGetUnsyncedProgress).toHaveBeenCalledTimes(2);
      expect(result.progressSynced).toBe(1);
      expect(result.sessionsSynced).toBe(0); // hardcoded no-op — assert so regressions are caught (QA fix #4)
      expect(result.totalPending).toBe(0);
    });

    it("skips rows that belong to a different user", async () => {
      const authedUid = "auth-user-2";
      const offlineUid = "offline-0000";
      mockGetUser.mockResolvedValue({ data: { user: { id: authedUid } }, error: null });
      mockGetUnsyncedProgress
        .mockResolvedValueOnce([makeProgress(offlineUid)])
        .mockResolvedValue([makeProgress(offlineUid)]);
      mockGetUnsyncedSessions.mockResolvedValue([]);

      const { syncUserProgress } = await import("@/services/progressSync");
      const result = await syncUserProgress();

      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockMarkProgressSynced).not.toHaveBeenCalled();
      expect(result.progressSynced).toBe(0);
      expect(result.sessionsSynced).toBe(0);
      // The offline row is still pending
      expect(result.totalPending).toBe(1);
    });

    it("returns zero synced when there is no authenticated user", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      mockGetUnsyncedProgress.mockResolvedValue([]);
      mockGetUnsyncedSessions.mockResolvedValue([]);

      const { syncUserProgress } = await import("@/services/progressSync");
      const result = await syncUserProgress();

      expect(mockUpsert).not.toHaveBeenCalled();
      expect(result.progressSynced).toBe(0);
      expect(result.sessionsSynced).toBe(0);
    });

    it("returns zero synced when getUser returns an error (QA fix #3)", async () => {
      // Covers the path where auth check itself fails — distinct from user: null.
      // syncPending destructures only `data.user`, so an error object in the
      // response must not cause a throw; user will be undefined/null and the
      // function must exit cleanly with progressSynced: 0.
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "network error during auth check" },
      });
      mockGetUnsyncedProgress.mockResolvedValue([]);
      mockGetUnsyncedSessions.mockResolvedValue([]);

      const { syncUserProgress } = await import("@/services/progressSync");
      const result = await syncUserProgress();

      expect(mockUpsert).not.toHaveBeenCalled();
      expect(result.progressSynced).toBe(0);
      expect(result.sessionsSynced).toBe(0);
    });

    it("leaves row unsynced and records retry entry when Supabase upsert fails", async () => {
      const uid = "auth-user-fail";
      mockGetUser.mockResolvedValue({ data: { user: { id: uid } }, error: null });
      mockUpsert.mockResolvedValue({ error: { message: "network error" } });
      mockGetUnsyncedProgress
        .mockResolvedValueOnce([makeProgress(uid)])
        // After failed sync the row is still unsynced
        .mockResolvedValue([makeProgress(uid)]);
      mockGetUnsyncedSessions.mockResolvedValue([]);

      const { syncUserProgress } = await import("@/services/progressSync");
      const result = await syncUserProgress();

      expect(mockMarkProgressSynced).not.toHaveBeenCalled();
      expect(result.progressSynced).toBe(0);
      expect(result.sessionsSynced).toBe(0);
      expect(result.totalPending).toBe(1);
    });
  });

  describe("autoSyncOnSignIn", () => {
    it("returns null when userId is null (not signed in)", async () => {
      const { autoSyncOnSignIn } = await import("@/services/progressSync");
      const result = await autoSyncOnSignIn(null);
      expect(result).toBeNull();
    });

    it("triggers syncUserProgress when a userId is provided", async () => {
      const uid = "auth-user-3";
      mockGetUser.mockResolvedValue({ data: { user: { id: uid } }, error: null });
      mockGetUnsyncedProgress.mockResolvedValue([]);
      mockGetUnsyncedSessions.mockResolvedValue([]);

      const { autoSyncOnSignIn } = await import("@/services/progressSync");
      const result = await autoSyncOnSignIn(uid);

      expect(result).not.toBeNull();
      expect(result?.progressSynced).toBe(0);
      expect(result?.sessionsSynced).toBe(0);
    });
  });

  // TODO: Complete these tests when GameControls and VoiceInput are integrated
  describe.skip("Voice Feature Offline Handling", () => {
    it.skip("disables voice and shows banner when offline", () => {
      // TODO: Test actual GameControls component integration
    });

    it.skip("stops recording if connection lost mid-session", () => {
      // TODO: Test VoiceInput component behavior
    });

    it.skip("re-enables voice when connection restored", () => {
      // TODO: Test voice button state transitions
    });
  });

  // TODO: Complete these tests when UI components are integrated
  describe.skip("UI Component Integration", () => {
    it.skip("updates sync status indicator when items queued", async () => {
      // TODO: Test SyncStatus component display
    });

    it.skip("shows toast notification on reconnection", () => {
      // TODO: Test toast behavior when online event triggered
    });

    it.skip("offline indicator appears when connection lost", () => {
      // TODO: Test OfflineIndicator component visibility
    });
  });
});
