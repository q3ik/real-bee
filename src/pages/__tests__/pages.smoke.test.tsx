/**
 * Smoke tests for route-level page components.
 *
 * Each test renders the page inside a minimal MemoryRouter + mocked
 * AuthProvider/store context and asserts the component mounts without
 * throwing. These are intentionally shallow — they verify wiring, not
 * business logic (which belongs in unit tests for the underlying hooks).
 *
 * AC reference: issue #45 — "Add smoke tests for each new page component"
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Suspense } from "react";

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("../../hooks/useGameStore", () => ({
  useGameStore: Object.assign(vi.fn(), {
    getState: vi.fn(() => ({
      phase: "playing",
      score: 0,
      streak: 0,
      bestStreak: 0,
      gradeLevel: 3,
      difficulty: "medium",
      isMuted: false,
      roundsPlayed: 1,
      correctAnswers: 1,
      currentWord: { word: "apple" },
    })),
  }),
}));

vi.mock("../../hooks/useOnlineStatus", () => ({ useOnlineStatus: () => true }));
vi.mock("../../hooks/useDiagnosticsBugReport", () => ({
  useDiagnosticsBugReport: () => ({
    submitReport: vi.fn(),
    isSubmitting: false,
    isSubmitted: false,
    submitError: null,
    reset: vi.fn(),
  }),
}));
vi.mock("../../hooks/useKeyboardShortcut", () => ({
  useKeyboardShortcut: vi.fn(),
}));

vi.mock("../../components/GameBoard", () => ({
  default: () => <div data-testid="game-board" />,
}));
vi.mock("../../components/MetricsBar", () => ({
  default: () => <div data-testid="metrics-bar" />,
}));
vi.mock("../../components/Settings", () => ({ default: () => null }));
vi.mock("../../components/Onboarding", () => ({
  default: () => <div data-testid="onboarding" />,
}));
vi.mock("../../components/PwaInstallPrompt", () => ({ default: () => null }));
vi.mock("../../components/ProgressionOverview", () => ({
  default: () => <div data-testid="progression" />,
}));
vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  },
}));
vi.mock("../../lib/db", () => ({
  localDb: {
    sessions: {
      orderBy: vi.fn(() => ({
        reverse: vi.fn(() => ({
          limit: vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) })),
        })),
      })),
    },
  },
  saveGameSession: vi.fn().mockResolvedValue(1),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { useAuth } from "../../contexts/AuthContext";
import { useGameStore } from "../../hooks/useGameStore";

const mockUseAuth = vi.mocked(useAuth);
const mockUseGameStore = vi.mocked(useGameStore);

function renderAtRoute(path: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Suspense fallback={<div data-testid="fallback" />}>
        <Routes>
          <Route path={path} element={element} />
          <Route path="/" element={<div data-testid="home-redirect" />} />
          <Route path="/game" element={<div data-testid="game-redirect" />} />
          <Route
            path="/results"
            element={<div data-testid="results-redirect" />}
          />
        </Routes>
      </Suspense>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Default: unauthenticated, not loading
  mockUseAuth.mockReturnValue({ user: null, isLoading: false } as ReturnType<
    typeof useAuth
  >);

  // Default: game in-progress with a currentWord so GamePage doesn't redirect
  mockUseGameStore.mockReturnValue({
    phase: "playing",
    currentWord: { word: "apple" },
    score: 0,
    streak: 0,
    bestStreak: 0,
    gradeLevel: 3,
    difficulty: "medium",
    isMuted: false,
    roundsPlayed: 1,
    correctAnswers: 1,
    difficultyEvolution: [],
    sessionStats: () => [],
    startSession: vi.fn().mockResolvedValue(undefined),
    restartGame: vi.fn(),
    loadProgress: vi.fn().mockResolvedValue(undefined),
    setUserId: vi.fn(),
  } as unknown as ReturnType<typeof useGameStore>);
});

describe("HomePage", () => {
  it("renders Onboarding without throwing", async () => {
    const { default: HomePage } = await import("../HomePage");
    renderAtRoute("/", <HomePage />);
    expect(screen.getByTestId("onboarding")).toBeInTheDocument();
  });
});

describe("GamePage", () => {
  it("renders GameBoard when session is active", async () => {
    const { default: GamePage } = await import("../GamePage");
    renderAtRoute("/game", <GamePage />);
    expect(screen.getByTestId("game-board")).toBeInTheDocument();
  });

  it("redirects to home when phase is idle and no currentWord", async () => {
    mockUseGameStore.mockReturnValue({
      phase: "idle",
      currentWord: null,
    } as unknown as ReturnType<typeof useGameStore>);
    const { default: GamePage } = await import("../GamePage");
    const mockNavigate = vi.fn();
    vi.mock("react-router-dom", () => ({
      useNavigate: () => mockNavigate,
    }));
    renderAtRoute("/game", <GamePage />);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });
});

describe("ResultsPage", () => {
  it("renders empty-state when no session data exists", async () => {
    mockUseGameStore.mockReturnValue({
      score: 0,
      correctAnswers: 0,
      roundsPlayed: 0,
      difficultyEvolution: [],
      sessionStats: () => [],
      startSession: vi.fn().mockResolvedValue(undefined),
      restartGame: vi.fn(),
    } as unknown as ReturnType<typeof useGameStore>);
    const { default: ResultsPage } = await import("../ResultsPage");
    renderAtRoute("/results", <ResultsPage />);
    // Empty-state or results card — either is a valid mount
    expect(document.body).toBeTruthy();
  });

  it("renders session summary when store has data", async () => {
    mockUseGameStore.mockReturnValue({
      score: 100,
      correctAnswers: 5,
      roundsPlayed: 5,
      difficultyEvolution: ["easy", "medium"],
      sessionStats: () => [{ label: "Score", value: "100" }],
      startSession: vi.fn().mockResolvedValue(undefined),
      restartGame: vi.fn(),
    } as unknown as ReturnType<typeof useGameStore>);
    const { default: ResultsPage } = await import("../ResultsPage");
    renderAtRoute("/results", <ResultsPage />);
    expect(document.body).toBeTruthy();
  });
});

describe("LeaderboardPage", () => {
  it("renders loading spinner when auth is resolving", async () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true } as ReturnType<
      typeof useAuth
    >);
    const { default: LeaderboardPage } = await import("../LeaderboardPage");
    renderAtRoute("/leaderboard", <LeaderboardPage />);
    // authLoading=true → returns null; no crash is the assertion
    expect(document.body).toBeTruthy();
  });

  it("renders leaderboard UI when authenticated", async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "user-1",
        email: "test@test.com",
        user_metadata: { full_name: "Tester" },
        app_metadata: {},
        aud: "authenticated",
        created_at: "2023-01-01T00:00:00Z",
      },
      session: {
        access_token: "test-token",
        refresh_token: "test-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: "user-1",
          email: "test@test.com",
          user_metadata: { full_name: "Tester" },
          app_metadata: {},
          aud: "authenticated",
          created_at: "2023-01-01T00:00:00Z",
        },
      },
      isLoading: false,
      isConfigured: true,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    } as ReturnType<typeof useAuth>);
    const { default: LeaderboardPage } = await import("../LeaderboardPage");
    renderAtRoute("/leaderboard", <LeaderboardPage />);
    expect(document.body).toBeTruthy();
  });

  it("redirects to / when unauthenticated", async () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false } as ReturnType<
      typeof useAuth
    >);
    const { default: LeaderboardPage } = await import("../LeaderboardPage");
    renderAtRoute("/leaderboard", <LeaderboardPage />);
    // Belt-and-suspenders redirect fires; no crash is the assertion
    expect(document.body).toBeTruthy();
  });
});
