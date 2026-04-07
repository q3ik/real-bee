/**
 * Type extensions for custom window properties used in E2E tests.
 * These properties are set by audio-mocks.ts addInitScript callbacks
 * and accessed via page.evaluate() calls.
 */

interface SpeechHistoryRecord {
  text: string;
  timestamp: number;
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
}

interface SyncQueueItem {
  retryCount: number;
  [key: string]: unknown;
}

interface TestHelpers {
  queueSyncItem(type: string, data: Record<string, unknown>): Promise<void>;
  getSyncQueue(): Promise<SyncQueueItem[]>;
  syncAllPending(): Promise<void>;
}

interface Window {
  __originalSpeechSynthesis: SpeechSynthesis | undefined;
  __spokenUtterances: string[];
  __speechHistory: SpeechHistoryRecord[];
  __lastSpokenText: string;
  /** Exposed only when VITE_TEST_MODE=true (see offline-sync.spec.ts) */
  __testHelpers__: TestHelpers | undefined;
  webkitAudioContext: typeof AudioContext | undefined;
}
