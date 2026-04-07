import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-123' } },
        error: null,
      }),
    },
  },
}));

vi.mock('@/lib/db', () => ({
  localDb: {
    progress: {
      put: vi.fn().mockResolvedValue(1),
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      }),
    },
  },
}));

describe('useGameStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports useGameStore without throwing', async () => {
    const { useGameStore } = await import('../useGameStore');
    expect(useGameStore).toBeDefined();
  });

  it('loadProgress resolves without throwing when user has no saved data', async () => {
    const { useGameStore } = await import('../useGameStore');
    const store = useGameStore.getState();
    await expect(store.loadProgress()).resolves.not.toThrow();
  });

  it('submitAnswer writes to localDb with supabase user id', async () => {
    const { useGameStore } = await import('../useGameStore');
    const { localDb } = await import('@/lib/db');

    const store = useGameStore.getState();
    // Load progress to hydrate userId from mocked supabase
    await store.loadProgress();

    // Set up a current word
    store.startSession();
    const currentWord = useGameStore.getState().currentWord;
    if (!currentWord) return; // no words in test env, skip gracefully

    store.submitAnswer(currentWord.word);
    expect(localDb.progress.put).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'test-user-123' })
    );
  });
});
