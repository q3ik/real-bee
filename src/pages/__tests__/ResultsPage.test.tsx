import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ResultsPage from "../ResultsPage";
import { useGameStore } from "../../hooks/useGameStore";
import { localDb } from "../../lib/db";

vi.mock("../../components/ProgressionOverview", () => ({
  default: () => <div data-testid="progression-overview" />,
}));

vi.mock("../../hooks/useGameStore", () => ({
  useGameStore: vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  localDb: {
    sessions: {
      orderBy: vi.fn(),
    },
  },
}));

const mockUseGameStore = vi.mocked(useGameStore);
const mockOrderBy = vi.mocked(localDb.sessions.orderBy);

function renderResultsPage() {
  return render(
    <MemoryRouter initialEntries={["/results"]}>
      <Routes>
        <Route path="/" element={<div>Home</div>} />
        <Route path="/game" element={<div>Game</div>} />
        <Route path="/leaderboard" element={<div>Leaderboard</div>} />
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ResultsPage", () => {
  beforeEach(() => {
    mockOrderBy.mockReset();
    mockUseGameStore.mockReturnValue({
      startSession: vi.fn().mockResolvedValue(undefined),
      restartGame: vi.fn(),
      sessionCompleted: false,
      difficultyEvolution: [],
      sessionStats: vi.fn(() => []),
    } as unknown as ReturnType<typeof useGameStore>);
  });

  it("shows a loading state before the IndexedDB fallback resolves", () => {
    mockOrderBy.mockReturnValue({
      reverse: vi.fn(() => ({
        limit: vi.fn(() => ({
          toArray: vi.fn(() => new Promise(() => {})),
        })),
      })),
    } as never);

    renderResultsPage();

    expect(screen.getByText("Loading results")).toBeInTheDocument();
  });

  it("renders the latest persisted session after a reload", async () => {
    mockOrderBy.mockReturnValue({
      reverse: vi.fn(() => ({
        limit: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue([
            {
              id: 7,
              uid: "user-1",
              startTime: "2026-04-27T18:00:00.000Z",
              endTime: "2026-04-27T18:04:00.000Z",
              wordsSpelled: 5,
              correctCount: 4,
              scoreChange: 120,
              bestStreak: 3,
              difficultyEvolution: [1, 1, -1, 1, 1],
              synced: false,
            },
          ]),
        })),
      })),
    } as never);

    renderResultsPage();

    expect(screen.getByText("Loading results")).toBeInTheDocument();
    expect(await screen.findByText("Session Complete!")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("+120")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4m")).toBeInTheDocument();
    expect(screen.getByTestId("progression-overview")).toBeInTheDocument();
  });

  it("shows the empty state when there is no current session and no persisted session", async () => {
    mockOrderBy.mockReturnValue({
      reverse: vi.fn(() => ({
        limit: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue([]),
        })),
      })),
    } as never);

    renderResultsPage();

    await waitFor(() => {
      expect(screen.getByText("No session yet")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Back Home" })).toBeInTheDocument();
  });

  it("uses live store data during the normal post-game flow", async () => {
    const storeSessionStats = vi.fn(() => [
      { label: "Rounds", value: 5 },
      { label: "Accuracy", value: "100%" },
      { label: "Best streak", value: 5 },
      { label: "Score change", value: "+150" },
      { label: "Time played", value: "3m" },
    ]);

    mockUseGameStore.mockReturnValue({
      startSession: vi.fn().mockResolvedValue(undefined),
      restartGame: vi.fn(),
      sessionCompleted: true,
      difficultyEvolution: [1, 1, 1, 1, 1],
      sessionStats: storeSessionStats,
    } as unknown as ReturnType<typeof useGameStore>);

    renderResultsPage();

    expect(await screen.findByText("Session Complete!")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("+150")).toBeInTheDocument();
    expect(mockOrderBy).not.toHaveBeenCalled();
  });
});
