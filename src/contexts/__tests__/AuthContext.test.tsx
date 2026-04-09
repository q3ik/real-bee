import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, render, screen, act } from "@testing-library/react";
import React from "react";
import { AuthProvider, useAuth } from "../AuthContext";

// Mock Supabase
vi.mock("../../lib/supabase", () => {
  const mockAuth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: {} }),
    signOut: vi.fn().mockResolvedValue({}),
  };

  return {
    supabase: {
      auth: mockAuth,
    },
  };
});

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  describe("useAuth", () => {
    it("throws when used outside AuthProvider", () => {
      // Suppress expected error in test output
      vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => renderHook(() => useAuth())).toThrow(
        "useAuth() must be used within an <AuthProvider>.",
      );
    });

    it("provides auth state within AuthProvider", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Initial state: isLoading is true while getSession() resolves
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isConfigured).toBe(true);
      expect(typeof result.current.signInWithGoogle).toBe("function");
      expect(typeof result.current.signOut).toBe("function");

      // Wait for getSession to resolve
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("AuthProvider", () => {
    it("renders children", () => {
      render(
        <AuthProvider>
          <div data-testid="child">Hello</div>
        </AuthProvider>,
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("calls signInWithOAuth on sign in", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signInWithGoogle();
      });

      const { supabase } = await import("../../lib/supabase");
      expect(supabase!.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: expect.any(String) },
      });
    });

    it("calls signOut on sign out", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signOut();
      });

      const { supabase } = await import("../../lib/supabase");
      expect(supabase!.auth.signOut).toHaveBeenCalled();
    });
  });
});
