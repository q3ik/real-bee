import { lazy, Suspense, type ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "./contexts/AuthContext";
import AdminFeedback from "./pages/admin/Feedback";

// Page-level route chunks — imported lazily for code splitting.
// IMPORTANT: Do NOT import these via src/pages/index.ts (the barrel) from
// this file or any other route-level file. Static barrel imports defeat
// React.lazy() code splitting and eagerly load all page chunks.
const HomePage = lazy(() => import("./pages/HomePage"));
const GamePage = lazy(() => import("./pages/GamePage"));
const ResultsPage = lazy(() => import("./pages/ResultsPage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));

export function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50/50 to-white">
      <div className="w-10 h-10 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin" />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Show spinner while auth state resolves — avoids a blank screen on slow
  // connections.
  if (isLoading) return <PageFallback />;

  if (!user) {
    // Redirect to home without requireSignIn state — nothing in HomePage
    // currently consumes it, so omitting it prevents dead state confusion.
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
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
          {/* Hash-based admin route preserved as a proper route inside the
              router context so any future useNavigate/useLocation calls inside
              AdminFeedback do not throw. Legacy #/admin links redirect here. */}
          <Route path="/admin/*" element={<AdminFeedback />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      <Toaster position="top-center" richColors closeButton />
    </BrowserRouter>
  );
}
