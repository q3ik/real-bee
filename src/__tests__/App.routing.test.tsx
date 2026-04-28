import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../components/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock("../components/ProtectedRoute", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "test-user",
      email: "test@example.com",
      user_metadata: {},
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
        id: "test-user",
        email: "test@example.com",
        user_metadata: {},
        app_metadata: {},
        aud: "authenticated",
        created_at: "2023-01-01T00:00:00Z",
      },
    },
    isLoading: false,
    isConfigured: true,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("../pages/admin/Feedback", () => ({
  default: () => <div data-testid="admin-feedback">Admin Feedback</div>,
}));

vi.mock("../pages/HomePage.tsx", () => ({
  default: () => <div data-testid="home-page">Home Page</div>,
}));

vi.mock("../pages/GamePage.tsx", () => ({
  default: () => <div data-testid="game-page">Game Page</div>,
}));

vi.mock("../pages/ResultsPage.tsx", () => ({
  default: () => <div data-testid="results-page">Results Page</div>,
}));

vi.mock("../pages/LeaderboardPage.tsx", () => ({
  default: () => <div data-testid="leaderboard-page">Leaderboard Page</div>,
}));

import App from "../App";

function setRoute(path: string, hash = "") {
  window.history.pushState({}, "", path + hash);
}

describe("App routing", () => {
  beforeEach(() => {
    setRoute("/");
  });

  it("renders AdminFeedback on /admin route", async () => {
    // The legacy #/admin hash triggers a window.location.href redirect via
    // useEffect which cannot be asserted in jsdom. However, the canonical
    // /admin/* route must render AdminFeedback directly — this covers the
    // post-redirect destination and is the behaviour users actually see.
    setRoute("/admin");
    render(<App />);
    expect(await screen.findByTestId("admin-feedback")).toBeInTheDocument();
  });

  it("renders home page on /", async () => {
    setRoute("/");

    render(<App />);

    expect(await screen.findByTestId("home-page")).toBeInTheDocument();
  });

  it("renders game page on /game", async () => {
    setRoute("/game");

    render(<App />);

    expect(await screen.findByTestId("game-page")).toBeInTheDocument();
  });

  it("renders results page on /results", async () => {
    setRoute("/results");

    render(<App />);

    expect(await screen.findByTestId("results-page")).toBeInTheDocument();
  });

  it("renders leaderboard page on /leaderboard", async () => {
    setRoute("/leaderboard");

    render(<App />);

    expect(await screen.findByTestId("leaderboard-page")).toBeInTheDocument();
  });

  it("redirects unknown routes to / and renders home page", async () => {
    setRoute("/some/unknown/path");

    render(<App />);

    expect(await screen.findByTestId("home-page")).toBeInTheDocument();
  });
});
