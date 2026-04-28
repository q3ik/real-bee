import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock syncPending before importing progressSync so the module sees the mock.
vi.mock('../../lib/sync', () => ({
  syncPending: vi.fn(),
}));

vi.mock('../../game-engine/storage', () => ({
  getUnsyncedProgress: vi.fn(),
  getUnsyncedSessions: vi.fn(),
}));

import { syncUserProgress, autoSyncOnSignIn } from '../progressSync';
import { syncPending } from '../../lib/sync';
import { getUnsyncedProgress, getUnsyncedSessions } from '../../game-engine/storage';

const mockSyncPending = vi.mocked(syncPending);
const mockGetUnsyncedProgress = vi.mocked(getUnsyncedProgress);
const mockGetUnsyncedSessions = vi.mocked(getUnsyncedSessions);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUnsyncedProgress.mockResolvedValue([]);
  mockGetUnsyncedSessions.mockResolvedValue([]);
});

describe('syncUserProgress', () => {
  it('returns a success result with correct counts on the happy path', async () => {
    mockSyncPending.mockResolvedValue(3);

    const result = await syncUserProgress();

    expect(result.progressSynced).toBe(3);
    expect(result.sessionsSynced).toBe(0);
    expect(result.totalPending).toBe(0);
    expect(result.error).toBeUndefined();
  });

  it('returns totalPending reflecting remaining unsynced records', async () => {
    mockSyncPending.mockResolvedValue(2);
    // Simulate 1 record still pending after sync
    mockGetUnsyncedProgress.mockResolvedValue([{ id: 'a' }] as never);
    mockGetUnsyncedSessions.mockResolvedValue([{ id: 'b' }, { id: 'c' }] as never);

    const result = await syncUserProgress();

    expect(result.totalPending).toBe(3);
    expect(result.error).toBeUndefined();
  });

  it('does NOT throw when syncPending rejects — returns error field instead', async () => {
    const boom = new Error('Network failure');
    mockSyncPending.mockRejectedValue(boom);

    // Must not throw
    const result = await expect(syncUserProgress()).resolves.toBeDefined();
  });

  it('populates error field and returns zero counts when syncPending rejects', async () => {
    const boom = new Error('500 from Supabase');
    mockSyncPending.mockRejectedValue(boom);

    const result = await syncUserProgress();

    expect(result.error).toBe(boom);
    expect(result.progressSynced).toBe(0);
    expect(result.sessionsSynced).toBe(0);
    expect(result.totalPending).toBe(0);
  });

  it('populates error field when getUnsyncedProgress rejects after a successful sync', async () => {
    mockSyncPending.mockResolvedValue(1);
    mockGetUnsyncedProgress.mockRejectedValue(new Error('IndexedDB unavailable'));

    const result = await syncUserProgress();

    expect(result.error).toBeInstanceOf(Error);
    expect(result.progressSynced).toBe(0);
  });
});

describe('autoSyncOnSignIn', () => {
  it('returns null when userId is null', async () => {
    const result = await autoSyncOnSignIn(null);
    expect(result).toBeNull();
    expect(mockSyncPending).not.toHaveBeenCalled();
  });

  it('calls syncUserProgress and returns a SyncResult when userId is provided', async () => {
    mockSyncPending.mockResolvedValue(0);

    const result = await autoSyncOnSignIn('user-123');

    expect(result).not.toBeNull();
    expect(result?.error).toBeUndefined();
    expect(mockSyncPending).toHaveBeenCalledOnce();
  });
});
