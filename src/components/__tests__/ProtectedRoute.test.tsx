import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../ProtectedRoute";
import { useAuth, type AuthState } from "../../contexts/AuthContext";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);

function setAuthState(overrides: Partial<AuthState> = {}) {
  const defaultState: AuthState = {
    user: null,
    session: null,
    isLoading: false,
    isConfigured: true,
    signInWithGoogle: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
  };

  mockUseAuth.mockReturnValue({ ...defaultState, ...overrides });
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while auth is initializing", () => {
    setAuthState({ isLoading: true });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users to home route", () => {
    setAuthState({ user: null, isLoading: false });

    render(
      <MemoryRouter initialEntries={["/leaderboard"]}>
        <Routes>
          <Route path="/" element={<div>Home Page</div>} />
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <div>Leaderboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Home Page")).toBeInTheDocument();
    expect(screen.queryByText("Leaderboard")).not.toBeInTheDocument();
  });

  it("renders children for authenticated users", () => {
    setAuthState({
      isLoading: false,
      user: { id: "user-1" } as AuthState["user"],
    });

    render(
      <MemoryRouter initialEntries={["/leaderboard"]}>
        <Routes>
          <Route path="/" element={<div>Home Page</div>} />
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <div>Leaderboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Leaderboard")).toBeInTheDocument();
    expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
  });
});
