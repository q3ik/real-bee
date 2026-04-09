import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncUserProgress, getPendingCount, autoSyncOnSignIn } from '../progressSync';

// Mock sync module
vi.mock('@/lib/sync', () => ({
  syncPending: vi.fn().mockResolvedValue(2),
}));

// Mock storage module
vi.mock('@/game-engine/storage', () => ({
  getUnsyncedProgress: vi.fn().mockResolvedValue([
    { uid: 'user-1', synced: false },
    { uid: 'user-2', synced: false },
  ]),
  getUnsyncedSessions: vi.fn().mockResolvedValue([
    { id: 1, uid: 'user-1', synced: false },
  ]),
  saveGameProgress: vi.fn().mockResolvedValue(undefined),
  loadGameProgress: vi.fn().mockResolvedValue(null),
  markProgressSynced: vi.fn().mockResolvedValue(undefined),
  saveSession: vi.fn().mockResolvedValue(1),
  markSessionsSynced: vi.fn().mockResolvedValue(undefined),
}));

describe('services/progressSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('syncUserProgress', () => {
    it('syncs pending progress', async () => {
      const result = await syncUserProgress('test-user');

      expect(result).toBeDefined();
      expect(result.progressSynced).toBe(2);
    });
  });

  describe('getPendingCount', () => {
    it('returns total unsynced records', async () => {
      const count = await getPendingCount();

      expect(count).toBe(3); // 2 progress + 1 session
    });
  });

  describe('autoSyncOnSignIn', () => {
    it('returns null when userId is null', async () => {
      const result = await autoSyncOnSignIn(null);
      expect(result).toBeNull();
    });

    it('syncs when userId is provided', async () => {
      const result = await autoSyncOnSignIn('test-user');

      expect(result).toBeDefined();
      expect(result!.progressSynced).toBe(2);
    });
  });
});
