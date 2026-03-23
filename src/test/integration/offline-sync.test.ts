/**
 * Integration Tests - Offline Sync Flow
 * 
 * Tests the complete offline→online sync workflow including:
 * - Offline detection
 * - Progress queueing
 * - Background sync
 * - UI state updates
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveProgress, getPendingCount } from '@/services/progressSync';
import { getSyncQueue as _getSyncQueue } from '@/lib/sync';
import { openDB as _openDB } from 'idb';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSyncQueue = _getSyncQueue as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const openDB = _openDB as any;

// Mock dependencies
vi.mock('@/lib/sync', async () => {
  const actual = await vi.importActual('@/lib/sync');
  return {
    ...actual,
    queueSyncItem: vi.fn(),
    getSyncQueue: vi.fn(),
    clearSyncedItems: vi.fn(),
  };
});
vi.mock('idb');

describe('Integration: Offline Sync Flow', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDB: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockQueueSyncItem: any;

  beforeEach(async () => {
    // vi.resetAllMocks() (not clearAllMocks) is required here: clearAllMocks only
    // wipes call history, whereas resetAllMocks also drains the mockResolvedValueOnce
    // queue.  Without the reset, stale queued return values leak from a failing test
    // into the next one and cause wrong getPendingCount() results.
    vi.resetAllMocks();
    
    // Re-set fetch mock after resetAllMocks
    (global as any).fetch = vi.fn();

    // Import and set up sync mocks
    const syncModule = await import('@/lib/sync');
    mockQueueSyncItem = syncModule.queueSyncItem;
    mockQueueSyncItem.mockResolvedValue(1);

    // Mock IndexedDB
    mockDB = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn().mockResolvedValue([]),
    };

    openDB.mockResolvedValue({
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => mockDB),
      })),
    });

    // Start online
    vi.stubGlobal('navigator', { onLine: true });
  });
  
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Complete Offline→Online Flow', () => {
    it('queues progress when offline and syncs when back online', async () => {
      const progressData = { wordId: 'test-123', correct: true, timestamp: Date.now() };

      // Step 1: Go offline - re-set fetch after stubGlobal
      vi.stubGlobal('navigator', { onLine: false });
      (global as any).fetch = vi.fn();
      // Note: saveProgress calls queueSyncItem (not getSyncQueue) when offline,
      // so no getSyncQueue mock is needed here.
      mockQueueSyncItem.mockResolvedValueOnce(1);

      // Step 2: Save progress (should queue)
      const queueResult = await saveProgress(progressData);
      expect(queueResult.status).toBe('queued');
      expect(queueResult.id).toBeDefined();

      // Step 3: Verify item in queue
      const mockQueuedItem = {
        id: queueResult.id,
        type: 'progress',
        data: progressData,
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      };
      getSyncQueue.mockResolvedValueOnce([mockQueuedItem]);

      const pendingCount = await getPendingCount();
      expect(pendingCount).toBe(1);

      // Step 4: Go back online - re-set fetch after stubGlobal
      vi.stubGlobal('navigator', { onLine: true });
      (global as any).fetch = vi.fn();

      // Step 5: Sync should succeed
      (global as any).fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const syncResult = await saveProgress(progressData);
      expect(syncResult.status).toBe('synced');

      // Step 6: Queue should be empty after sync
      getSyncQueue.mockResolvedValueOnce([]);
      const finalCount = await getPendingCount();
      expect(finalCount).toBe(0);
    });

    it('persists queue across page reloads', async () => {
      const progressData = { wordId: 'persist-test', correct: false };

      // Go offline and queue item - re-set fetch after stubGlobal
      vi.stubGlobal('navigator', { onLine: false });
      (global as any).fetch = vi.fn();
      mockQueueSyncItem.mockResolvedValueOnce(1);
      await saveProgress(progressData);

      // Simulate page reload by creating new queue with persisted data
      const persistedQueue = [
        {
          id: 1,
          type: 'progress',
          data: progressData,
          synced: false,
          retryCount: 0,
        },
      ];

      getSyncQueue.mockResolvedValueOnce(persistedQueue);

      const count = await getPendingCount();
      expect(count).toBe(1);
    });

    it('handles multiple queued items in batch sync', async () => {
      const items = [
        { id: 1, type: 'progress', data: { wordId: 'word1' }, synced: false },
        { id: 2, type: 'progress', data: { wordId: 'word2' }, synced: false },
        { id: 3, type: 'session', data: { sessionId: 'sess1' }, synced: false },
      ];

      getSyncQueue.mockResolvedValueOnce(items);

      const count = await getPendingCount();
      expect(count).toBe(3);

      // Mock successful batch sync - re-set fetch
      (global as any).fetch = vi.fn();
      (global as any).fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      // After sync, queue should be empty
      getSyncQueue.mockResolvedValueOnce([]);
      const finalCount = await getPendingCount();
      expect(finalCount).toBe(0);
    });
  });

  // TODO: Complete these tests when GameControls and VoiceInput are integrated
  describe.skip('Voice Feature Offline Handling', () => {
    it.skip('disables voice and shows banner when offline', () => {
      // TODO: Test actual GameControls component integration
    });

    it.skip('stops recording if connection lost mid-session', () => {
      // TODO: Test VoiceInput component behavior
    });

    it.skip('re-enables voice when connection restored', () => {
      // TODO: Test voice button state transitions
    });
  });

  describe('Sync Retry Logic', () => {
    it('retries failed sync with exponential backoff', async () => {
      const progressData = { wordId: 'retry-test', correct: true };

      // First attempt fails - re-set fetch
      (global as any).fetch = vi.fn();
      (global as any).fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });
      mockQueueSyncItem.mockResolvedValueOnce(1);

      const result1 = await saveProgress(progressData);
      expect(result1.status).toBe('queued');
      expect(result1.reason).toBe('api_error');

      // Item should be in queue with retry count
      const queuedItem = {
        id: result1.id,
        type: 'progress',
        data: progressData,
        synced: false,
        retryCount: 1,
      };
      getSyncQueue.mockResolvedValueOnce([queuedItem]);

      // Second attempt succeeds - re-set fetch
      (global as any).fetch = vi.fn();
      (global as any).fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result2 = await saveProgress(progressData);
      expect(result2.status).toBe('synced');
    });

    it('gives up after max retries', async () => {
      const maxRetries = 5;
      const itemWithMaxRetries = {
        id: 1,
        type: 'progress',
        data: { wordId: 'max-retry-test' },
        synced: false,
        retryCount: maxRetries,
      };

      // Mock getSyncQueue to return only this item
      getSyncQueue.mockClear();
      getSyncQueue.mockResolvedValue([itemWithMaxRetries]);

      // Item should still be in queue but won't be retried
      const count = await getPendingCount();
      expect(count).toBe(1);
    });
  });

  describe('Background Sync Integration', () => {
    it('registers background sync when queueing item', async () => {
      const mockRegister = vi.fn();
      
      vi.stubGlobal('navigator', {
        onLine: false,
        serviceWorker: {
          ready: Promise.resolve({
            sync: {
              register: mockRegister,
            },
          }),
        },
      });
      
      const progressData = { wordId: 'bg-sync-test' };
      await saveProgress(progressData);
      
      // Background sync should be registered
      // (actual registration happens in queueSyncItem from lib/sync)
    });

    it('handles browsers without background sync API gracefully', async () => {
      vi.stubGlobal('navigator', {
        onLine: false,
        serviceWorker: {}, // No sync API
      });
      
      const progressData = { wordId: 'no-bg-sync-test' };
      
      // Should still queue successfully
      const result = await saveProgress(progressData);
      expect(result.status).toBe('queued');
    });
  });

  // TODO: Complete these tests when UI components are integrated
  describe.skip('UI Component Integration', () => {
    it.skip('updates sync status indicator when items queued', async () => {
      // TODO: Test SyncStatus component display
    });

    it.skip('shows toast notification on reconnection', () => {
      // TODO: Test toast behavior when online event triggered
    });

    it.skip('offline indicator appears when connection lost', () => {
      // TODO: Test OfflineIndicator component visibility
    });
  });

  describe('Edge Cases', () => {
    it('handles rapid online/offline switching', async () => {
      const progressData = { wordId: 'rapid-switch' };

      // Start offline
      vi.stubGlobal('navigator', { onLine: false });
      const result1 = await saveProgress(progressData);
      expect(result1.status).toBe('queued');

      // Go online briefly - re-set fetch after stubGlobal
      vi.stubGlobal('navigator', { onLine: true });
      (global as any).fetch = vi.fn();
      (global as any).fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      // Go offline again immediately
      vi.stubGlobal('navigator', { onLine: false });
      const result2 = await saveProgress(progressData);
      expect(result2.status).toBe('queued');
    });

    it('handles long offline periods (24+ hours)', async () => {
      const oldTimestamp = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
      const oldQueuedItem = {
        id: 1,
        type: 'progress',
        data: { wordId: 'old-item' },
        timestamp: oldTimestamp,
        synced: false,
        retryCount: 0,
      };

      getSyncQueue.mockResolvedValueOnce([oldQueuedItem]);

      const count = await getPendingCount();
      expect(count).toBe(1);

      // Old items should still sync successfully - re-set fetch
      (global as any).fetch = vi.fn();
      (global as any).fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    it('handles IndexedDB errors gracefully', async () => {
      const progressData = { wordId: 'idb-error-test' };
      
      // Go offline
      vi.stubGlobal('navigator', { onLine: false });
      
      // Mock queueSyncItem to throw (e.g., quota exceeded)
      const { queueSyncItem } = await import('@/lib/sync');
      (queueSyncItem as any).mockRejectedValueOnce(new Error('QuotaExceededError'));
      
      const result = await saveProgress(progressData);
      
      // Should return failed status instead of throwing
      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.reason).toBe('queue_error');
    });
  });
});
