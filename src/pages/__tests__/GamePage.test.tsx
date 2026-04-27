import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import GamePage from "../GamePage";

type Phase = "idle" | "playing" | "round_end";

interface MockGameStoreState {
  phase: Phase;
  sessionCompleted: boolean;
}

const mockNavigate = vi.fn();

let mockState: MockGameStoreState = {
  phase: "idle",
  sessionCompleted: false,
};

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../components/GameBoard", () => ({
  default: () => <div data-testid="game-board">Game Board</div>,
}));

vi.mock("../../hooks/useGameStore", () => ({
  useGameStore: (selector: (state: MockGameStoreState) => unknown) =>
    selector(mockState),
}));

describe("GamePage", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockState = {
      phase: "idle",
      sessionCompleted: false,
    };
  });

  it("renders the game board", () => {
    render(<GamePage />);
    expect(screen.getByTestId("game-board")).toBeInTheDocument();
  });

  it("does not redirect on initial idle state when session is not completed", async () => {
    mockState.phase = "idle";
    mockState.sessionCompleted = false;

    render(<GamePage />);

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it("redirects to /results when phase is idle and session is completed", async () => {
    mockState.phase = "idle";
    mockState.sessionCompleted = true;

    render(<GamePage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/results", { replace: true });
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("does not redirect repeatedly while remaining in the same idle completed state", async () => {
    mockState.phase = "idle";
    mockState.sessionCompleted = true;

    const { rerender } = render(<GamePage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });

    rerender(<GamePage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
  });

  it("allows a new redirect after leaving idle and returning to idle completed", async () => {
    mockState.phase = "idle";
    mockState.sessionCompleted = true;

    const { rerender } = render(<GamePage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });

    mockState.phase = "playing";
    mockState.sessionCompleted = false;
    rerender(<GamePage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });

    mockState.phase = "idle";
    mockState.sessionCompleted = true;
    rerender(<GamePage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledTimes(2);
    });
  });
});
