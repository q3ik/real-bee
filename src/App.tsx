import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "./contexts/AuthContext";
import AdminFeedback from "./pages/admin/Feedback";

// All page-level components are lazy-loaded so the initial bundle stays small.
const HomePage = lazy(() => import("./pages/HomePage"));
const GamePage = lazy(() => import("./pages/GamePage"));
const ResultsPage = lazy(() => import("./pages/ResultsPage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));

/** Full-page spinner shown while a lazy page chunk is loading. */
function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50/50 to-white">
      <div className="w-10 h-10 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin" />
    </div>
  );
}

/**
 * Auth-guard wrapper: redirects to "/" when the user is not signed in.
 * Used exclusively by LeaderboardPage.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // While auth is still initialising, render nothing to avoid a flash.
  if (isLoading) return null;

  if (!user) {
    return <Navigate to="/" state={{ from: location, requireSignIn: true }} replace />;
  }

  return <>{children}</>;
}

/**
 * App — router scaffold only.
 *
 * All layout chrome (MetricsBar, Settings panel, debug overlay) lives inside
 * the relevant page components. App.tsx is intentionally kept thin so that
 * adding new top-level routes does not require touching this file.
 *
 * Hash-based admin routing (#/admin/*) is handled client-side by detecting
 * window.location.hash before the router renders — this avoids polluting the
 * route table with an admin catch-all that could mask real 404s.
 */
export default function App() {
  // Hash-based admin routing: #/admin/feedback renders the admin panel.
  // This is evaluated once on mount; the admin panel is not part of the
  // React Router route tree so it does not participate in browser history.
  if (typeof window !== "undefined" && window.location.hash.startsWith("#/admin")) {
    return <AdminFeedback />;
  }

  return (
    <>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/game" element={<GamePage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route
            path="/leaderboard"
            element={
              <RequireAuth>
                <LeaderboardPage />
              </RequireAuth>
            }
          />
          {/* Catch-all: unknown paths fall back to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {/* Global Toast Notifications — outside Suspense so toasts survive
          page transitions */}
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}
