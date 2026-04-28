import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import GamePage from "../GamePage";

type Phase = "idle" | "playing" | "round_end" | "completed";

interface MockGameStoreState {
  phase: Phase;
  sessionCompleted: boolean;
  currentWord: string | null;
}

const mockNavigate = vi.fn();

let mockState: MockGameStoreState = {
  phase: "idle",
  sessionCompleted: false,
  currentWord: null,
};

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../components/GameBoard", () => ({
  default: () => <div data-testid="game-board">Game Board</div>,
}));

vi.mock("../../hooks/useGameStore", () => ({
  useGameStore: (selector?: (state: MockGameStoreState) => unknown) => {
    if (selector) {
      return selector(mockState);
    }
    // Return the full state when used with destructuring
    return mockState;
  },
}));

describe("GamePage", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockState = {
      phase: "idle",
      sessionCompleted: false,
      currentWord: null,
    };
  });

  it("renders the game board when phase is playing", () => {
    mockState.phase = "playing";
    mockState.currentWord = "test";

    render(<GamePage />);
    expect(screen.getByTestId("game-board")).toBeInTheDocument();
  });

  it("does not redirect when phase is playing", async () => {
    mockState.phase = "playing";
    mockState.currentWord = "test";

    render(<GamePage />);

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it("does not redirect on initial idle state when currentWord is present", async () => {
    mockState.phase = "idle";
    mockState.currentWord = "test";

    render(<GamePage />);

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it("redirects to / when phase is idle and no currentWord", async () => {
    mockState.phase = "idle";
    mockState.currentWord = null;

    render(<GamePage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("redirects to /results when phase is completed", async () => {
    mockState.phase = "completed";
    mockState.currentWord = null;

    render(<GamePage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/results", { replace: true });
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("does not redirect repeatedly while remaining in the same idle state", async () => {
    mockState.phase = "idle";
    mockState.currentWord = null;

    const { rerender } = render(<GamePage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);

    // Re-render with same state — should not redirect again
    rerender(<GamePage />);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  it("allows a new redirect after leaving idle and returning to idle", async () => {
    mockState.phase = "idle";
    mockState.currentWord = null;

    const { rerender } = render(<GamePage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);

    // Transition away from idle
    mockState.phase = "playing";
    rerender(<GamePage />);

    // Return to idle — should redirect again
    mockState.phase = "idle";
    rerender(<GamePage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(2);
    });
  });

  it("allows redirect after leaving completed and returning to completed", async () => {
    mockState.phase = "completed";
    mockState.currentWord = null;

    const { rerender } = render(<GamePage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/results", { replace: true });
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);

    // Transition away from completed
    mockState.phase = "playing";
    rerender(<GamePage />);

    // Return to completed — should redirect again
    mockState.phase = "completed";
    rerender(<GamePage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(2);
    });
  });
});
