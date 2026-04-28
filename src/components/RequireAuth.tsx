import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PageFallback } from "../App";

/**
 * RequireAuth — route-level auth guard.
 *
 * Renders a loading spinner while auth state resolves, then either:
 *  - renders children when a user is authenticated, or
 *  - redirects to "/" preserving the attempted location in `state.from`.
 *
 * Extracted from App.tsx so it can be tested independently with MemoryRouter
 * without needing the full App wrapper.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Show spinner while auth state resolves — avoids a blank screen on slow
  // connections.
  if (isLoading) return <PageFallback />;

  if (!user) {
    // Preserve the attempted location so HomePage could show a sign-in prompt
    // if it ever wants to consume state.from.
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
