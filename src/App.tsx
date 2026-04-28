import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import RequireAuth from "./components/RequireAuth";
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
