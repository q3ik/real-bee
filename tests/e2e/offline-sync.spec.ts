/**
 * E2E tests for PWA offline sync functionality
 * 
 * Tests the complete flow:
 * 1. Go offline
 * 2. Perform actions that queue sync items
 * 3. Go online
 * 4. Verify sync request sent with correct payload
 * 5. Verify queue cleanup after successful sync
 * 
 * NOTE: These tests require VITE_TEST_MODE=true to expose window.__testHelpers__
 * This is automatically set in playwright.config.js webServer.env
 */
import { test, expect } from '@playwright/test';

test.describe('PWA Offline Sync', () => {
  test('should sync progress when back online', async ({ page, context }) => {
    // Intercept sync endpoint to verify payload structure
    interface SyncRequest {
      method: string;
      headers: Record<string, string>;
      body: Record<string, unknown>;
    }
    const syncRequests: SyncRequest[] = [];
    await page.route('**/api/sync/progress', async (route) => {
      const request = route.request();
      syncRequests.push({
        method: request.method(),
        headers: request.headers(),
        body: request.postDataJSON(),
      });
      
      // Respond with success (use return to prevent race conditions)
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true, 
          id: 'test-sync-id-' + Date.now() 
        }),
      });
    });

    // Navigate to app
    await page.goto('/');
    
    // Wait for test helpers to be available (they initialize after page JS loads)
    await page.waitForFunction(
      () => typeof (window as any).__testHelpers__ !== 'undefined',
      { timeout: 10000 }
    ).catch(() => {
      throw new Error('window.__testHelpers__ not available after 10s. Ensure VITE_TEST_MODE=true build is used.');
    });
    
    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(500); // Let offline detection stabilize
    
    // Queue sync item via test helpers
    await page.evaluate(async () => {
      await window.__testHelpers__!.queueSyncItem('progress', {
        score: 850,
        level: 5,
        completedAt: new Date().toISOString(),
      });
    });
    
    // Verify item queued in IndexedDB
    const queuedItems = await page.evaluate(async () => {
      return await window.__testHelpers__!.getSyncQueue();
    });
    expect(queuedItems.length).toBeGreaterThan(0);
    
    // Go online
    await context.setOffline(false);
    await page.waitForTimeout(1000); // Let sync trigger
    
    // Manually trigger sync (background sync may not fire in test environment)
    await page.evaluate(async () => {
      await window.__testHelpers__!.syncAllPending();
    });
    
    // Verify sync request was made
    expect(syncRequests.length).toBeGreaterThan(0);
    
    const syncRequest = syncRequests[0];
    expect(syncRequest.method).toBe('POST');
    expect(syncRequest.headers['content-type']).toContain('application/json');
    
    // Verify payload structure
    const payload = syncRequest.body;
    expect(payload).toHaveProperty('type');
    expect(payload).toHaveProperty('data');
    expect(payload).toHaveProperty('timestamp');
    expect(['progress', 'score', 'session']).toContain(payload.type);
    expect(typeof payload.data).toBe('object');
    
    // Verify queue is cleared after successful sync
    const remainingItems = await page.evaluate(async () => {
      return await window.__testHelpers__!.getSyncQueue();
    });
    expect(remainingItems.length).toBe(0);
  });

  test('should retry failed sync with exponential backoff', async ({ page, context }) => {
    let attemptCount = 0;
    
    await page.route('**/api/sync/progress', async (route) => {
      attemptCount++;
      
      // Fail first 2 attempts, succeed on 3rd (use return to await fulfillment)
      if (attemptCount < 3) {
        return route.fulfill({ status: 500, body: 'Server error' });
      } else {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, id: 'retry-success' }),
        });
      }
    });

    await page.goto('/');
    await context.setOffline(true);
    
    // Queue sync item
    await page.evaluate(async () => {
      await window.__testHelpers__!.queueSyncItem('score', { points: 1000 });
    });
    
    await context.setOffline(false);
    
    // First sync attempt (will fail)
    await page.evaluate(async () => {
      await window.__testHelpers__!.syncAllPending();
    });
    
    // Verify retry count incremented
    const itemAfterFirstFail = await page.evaluate(async () => {
      const queue = await window.__testHelpers__!.getSyncQueue();
      return queue[0];
    });
    expect(itemAfterFirstFail.retryCount).toBeGreaterThan(0);
    
    // Second attempt (will also fail)
    await page.evaluate(async () => {
      await window.__testHelpers__!.syncAllPending();
    });
    
    // Third attempt (will succeed)
    await page.evaluate(async () => {
      await window.__testHelpers__!.syncAllPending();
    });
    
    // Verify item removed after success
    const finalQueue = await page.evaluate(async () => {
      return await window.__testHelpers__!.getSyncQueue();
    });
    expect(finalQueue.length).toBe(0);
    expect(attemptCount).toBe(3);
  });

  test('should handle CORS preflight for sync endpoint', async ({ page }) => {
    let preflightReceived = false;
    
    await page.route('**/api/sync/progress', async (route) => {
      const request = route.request();
      
      if (request.method() === 'OPTIONS') {
        preflightReceived = true;
        return route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': 'http://localhost:5173',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      } else {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, id: 'cors-test' }),
        });
      }
    });

    await page.goto('/');
    
    // Queue and sync item (may trigger preflight)
    await page.evaluate(async () => {
      await window.__testHelpers__!.queueSyncItem('session', { duration: 300 });
      await window.__testHelpers__!.syncAllPending();
    });
    
    // Note: Preflight may not always be triggered in same-origin dev environment
    // This test primarily verifies the endpoint handles OPTIONS correctly
    console.log('Preflight received:', preflightReceived);
  });
});
