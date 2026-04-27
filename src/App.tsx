import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminFeedback from "./pages/admin/Feedback";

const HomePage = lazy(() => import("./pages/HomePage.tsx"));
const GamePage = lazy(() => import("./pages/GamePage.tsx"));
const ResultsPage = lazy(() => import("./pages/ResultsPage.tsx"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage.tsx"));

export default function App() {
  const isAdminRoute =
    typeof window !== "undefined" && window.location.hash.startsWith("#/admin");

  if (isAdminRoute) {
    return <AdminFeedback />;
  }

  return (
    <BrowserRouter>
      <AppLayout>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              Loading…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/game" element={<GamePage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route
              path="/leaderboard"
              element={
                <ProtectedRoute>
                  <LeaderboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppLayout>
    </BrowserRouter>
  );
}
