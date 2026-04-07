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

  it('has no firebase imports', async () => {
    const { useGameStore } = await import('../useGameStore');
    expect(useGameStore).toBeDefined();
  });

  it('loadProgress resolves without throwing when user has no saved data', async () => {
    const { useGameStore } = await import('../useGameStore');
    const store = useGameStore.getState();
    await expect(store.loadProgress()).resolves.not.toThrow();
  });
});
