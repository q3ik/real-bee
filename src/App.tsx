import { useState, useCallback, useEffect, useRef } from "react";
import { Toaster } from "sonner";
import { useGameStore } from "./hooks/useGameStore";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { useDiagnosticsBugReport } from "./hooks/useDiagnosticsBugReport";
import { useKeyboardShortcut } from "./hooks/useKeyboardShortcut";
import { useAuth } from "./contexts/AuthContext";
import Onboarding from "./components/Onboarding";
import GameBoard from "./components/GameBoard";
import MetricsBar from "./components/MetricsBar";
import Settings from "./components/Settings";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import AdminFeedback from "./pages/admin/Feedback";

export default function App() {
  const [view, setView] = useState<"onboarding" | "game">("onboarding");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugDescription, setDebugDescription] = useState("");
  const { startSession, loadProgress, setUserId } = useGameStore();
  const { user, isLoading } = useAuth();
  const isOnline = useOnlineStatus();

  const { submitReport, isSubmitting, isSubmitted, submitError, reset } =
    useDiagnosticsBugReport({ feature: "App" });

  // Track whether the initial post-auth-init load has already been triggered
  // so we only fire loadProgress() once on mount (not on every re-render).
  const initialLoadDone = useRef(false);

  // Effect 1: Once auth initialisation completes (isLoading → false), load
  // progress unconditionally. This covers signed-out and offline users who
  // would otherwise never hydrate their local progress because `user` is null.
  useEffect(() => {
    if (isLoading || initialLoadDone.current) return;
    initialLoadDone.current = true;
    void loadProgress();
  }, [isLoading, loadProgress]);

  // Effect 2: Whenever the authenticated identity changes after init, sync the
  // userId into the store and reload progress under the correct identity.
  // - user truthy  → signed in: store the auth UID and reload cloud/local progress.
  // - user null    → signed out: clear the auth UID so the store falls back to
  //                  the offline identity, then reload to hydrate offline progress.
  useEffect(() => {
    if (isLoading) return;
    if (user) {
      setUserId(user.id);
    } else {
      setUserId(null);
    }
    void loadProgress();
  }, [user, isLoading, loadProgress, setUserId]);

  // Global Ctrl+Shift+D shortcut — toggles the hidden debug/bug-report panel.
  //
  // ignoreInputFields is tied to !isDebugOpen:
  //   - panel CLOSED → ignore typing fields (won't fire inside search boxes etc.)
  //   - panel OPEN   → don't ignore (so the shortcut closes even from the textarea)
  //
  // useKeyboardShortcut already guards against event.repeat, so holding the
  // combo down won't rapidly toggle the panel.
  useKeyboardShortcut(
    "D",
    useCallback(() => {
      setIsDebugOpen((prev) => {
        const opening = !prev;
        if (opening) {
          // Only clear stale state when opening a fresh panel.
          reset();
          setDebugDescription("");
        }
        return opening;
      });
    }, [reset]),
    {
      modifiers: { ctrl: true, shift: true },
      ignoreInputFields: !isDebugOpen,
    },
  );

  const handleStart = () => {
    // setView('game') is intentionally placed inside .then() so the view
    // transition only happens after the session is ready (currentWord set).
    // On failure, wrappedStartSession restores gameStatus to 'lobby' and we
    // stay on the onboarding screen — no broken empty-game view (QA fix #4).
    void startSession()
      .then(() => {
        setView("game");
      })
      .catch((err: unknown) => {
        console.warn("[App] handleStart: startSession failed", err);
      });
  };

  const handleDebugSubmit = useCallback(async () => {
    // Snapshot game state at the moment the user clicks Send — reading from
    // the Zustand store directly avoids subscribing to high-frequency updates
    // at the hook level (which would cause the whole App to re-render on every
    // score/streak change).
    const {
      phase,
      score,
      streak,
      bestStreak,
      gradeLevel,
      difficulty,
      isMuted,
      roundsPlayed,
      correctAnswers,
      currentWord,
    } = useGameStore.getState();

    await submitReport(debugDescription || undefined, {
      gameState: {
        phase,
        score,
        streak,
        bestStreak,
        gradeLevel,
        difficulty,
        isMuted,
        roundsPlayed,
        correctAnswers,
        currentWord: currentWord?.word ?? null,
      },
    });
  }, [submitReport, debugDescription]);

  const handleDebugClose = useCallback(() => {
    setIsDebugOpen(false);
    reset();
    setDebugDescription("");
  }, [reset]);

  // Hash-based admin routing: #/admin/feedback shows the admin panel
  const isAdminRoute =
    typeof window !== "undefined" && window.location.hash.startsWith("#/admin");

  if (isAdminRoute) {
    return <AdminFeedback />;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50/50 to-white font-sans selection:bg-orange-200 selection:text-orange-900">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-100 bg-red-500 text-white text-center py-2 text-sm font-bold tracking-wide shadow-md">
          ⚠️ You&apos;re offline — game features may be limited
        </div>
      )}

      {/* PWA Install Prompt */}
      <PwaInstallPrompt />

      {view === "game" && (
        <MetricsBar onOpenSettings={() => setIsSettingsOpen(true)} />
      )}

      <main className="container mx-auto max-w-4xl">
        {view === "onboarding" ? (
          <Onboarding onStart={handleStart} />
        ) : (
          <GameBoard />
        )}
      </main>

      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Hidden debug / bug-report panel — toggle with Ctrl+Shift+D */}
      {isDebugOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Debug bug report panel"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-800">
                🐛 Debug Report
              </h2>
              <button
                onClick={handleDebugClose}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close debug panel"
              >
                ✕
              </button>
            </div>

            {isSubmitted ? (
              <div className="text-center space-y-3 py-4">
                <p className="text-green-600 font-bold text-lg">
                  ✅ Report sent!
                </p>
                <p className="text-gray-500 text-sm">
                  Diagnostics have been captured and forwarded.
                </p>
                <button
                  onClick={handleDebugClose}
                  className="px-6 py-3 bg-gray-800 text-white rounded-2xl font-bold"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <p className="text-gray-500 text-sm">
                  Describe what went wrong (optional). A snapshot of the current
                  session — score, streak, phase, difficulty — will be included
                  with the report.
                </p>
                <textarea
                  value={debugDescription}
                  onChange={(e) => setDebugDescription(e.target.value)}
                  placeholder="What were you doing when the issue occurred?"
                  rows={3}
                  className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm resize-none focus:border-orange-400 outline-none"
                />
                {submitError && (
                  <p className="text-red-500 text-xs">{submitError}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleDebugSubmit}
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 disabled:opacity-50 transition-all"
                  >
                    {isSubmitting ? "Sending…" : "Send Report"}
                  </button>
                  <button
                    onClick={handleDebugClose}
                    className="px-6 py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Global Toast Notifications */}
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
