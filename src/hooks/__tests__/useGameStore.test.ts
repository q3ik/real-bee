import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user-123" } },
        error: null,
      }),
    },
  },
}));

vi.mock("../../lib/db", () => ({
  localDb: {
    progress: {
      put: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue(null),
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      }),
    },
    preferences: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      }),
    },
  },
}));

vi.mock("../../lib/wordLoader", () => ({
  getWordsForConfigAsync: vi.fn().mockResolvedValue([
    {
      word: "cat",
      definition: "A small furry animal.",
      sentence: "The cat sat.",
      grade: 1,
      difficulty: "easy",
    },
    {
      word: "dog",
      definition: "A friendly pet.",
      sentence: "The dog barked.",
      grade: 1,
      difficulty: "easy",
    },
  ]),
  loadWordsForGrade: vi.fn().mockResolvedValue([
    {
      word: "cat",
      definition: "A small furry animal.",
      sentence: "The cat sat.",
      grade: 1,
      difficulty: "easy",
    },
    {
      word: "dog",
      definition: "A friendly pet.",
      sentence: "The dog barked.",
      grade: 1,
      difficulty: "easy",
    },
  ]),
  clearWordCache: vi.fn(),
  isGradeLoaded: vi.fn().mockReturnValue(false),
  getCachedGrades: vi.fn().mockReturnValue([]),
  VALID_GRADES: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const,
  WordLoaderError: class WordLoaderError extends Error {},
}));

describe("useGameStore", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("exports useGameStore without throwing", async () => {
    const { useGameStore } = await import("../useGameStore");
    expect(useGameStore).toBeDefined();
  });

  it("loadProgress resolves without throwing when user has no saved data", async () => {
    const { useGameStore } = await import("../useGameStore");
    const store = useGameStore.getState();
    await expect(store.loadProgress()).resolves.not.toThrow();
  });

  it("submitAnswer writes to localDb with supabase user id", async () => {
    const { useGameStore } = await import("../useGameStore");
    const { localDb } = await import("../../lib/db");

    const store = useGameStore.getState();
    // Load progress to hydrate userId from mocked supabase
    await store.loadProgress();

    // Start a session (mocked word list ensures we get words)
    await store.startSession();
    const currentState = useGameStore.getState();
    expect(currentState.currentWord).toBeDefined();
    expect(currentState.phase).toBe("playing");

    const currentWord = currentState.currentWord!;
    store.submitAnswer(currentWord.word);

    const afterState = useGameStore.getState();
    expect(afterState.phase).toBe("round_end");
    expect(afterState.result?.isCorrect).toBe(true);
    expect(localDb.progress.put).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "test-user-123" }),
    );
  });

  it("transitions to playing phase on startNewRound with a word", async () => {
    const { useGameStore } = await import("../useGameStore");
    const store = useGameStore.getState();

    await store.startSession();
    const state = useGameStore.getState();
    expect(state.phase).toBe("playing");
    expect(state.currentWord).not.toBeNull();
  });

  it("restartGame resets all state to defaults", async () => {
    const { useGameStore } = await import("../useGameStore");
    const store = useGameStore.getState();

    await store.startSession();
    store.restartGame();
    const state = useGameStore.getState();

    expect(state.phase).toBe("idle");
    expect(state.currentWord).toBeNull();
    expect(state.score).toBe(0);
    expect(state.streak).toBe(0);
  });

  it("timeoutRound transitions to round_end with isCorrect:false and resets streak", async () => {
    const { useGameStore } = await import("../useGameStore");
    const store = useGameStore.getState();

    await store.startSession();
    const before = useGameStore.getState();
    expect(before.phase).toBe("playing");

    store.timeoutRound();
    const after = useGameStore.getState();

    expect(after.phase).toBe("round_end");
    expect(after.result?.isCorrect).toBe(false);
    expect(after.result?.rawInput).toBe("");
    expect(after.streak).toBe(0);
    expect(after.roundsPlayed).toBe(before.roundsPlayed + 1);
  });

  it("timeoutRound is a no-op when phase is not playing", async () => {
    const { useGameStore } = await import("../useGameStore");
    const store = useGameStore.getState();

    // phase is "idle" by default
    store.timeoutRound();
    const state = useGameStore.getState();
    expect(state.phase).toBe("idle");
    expect(state.result).toBeNull();
  });
});
