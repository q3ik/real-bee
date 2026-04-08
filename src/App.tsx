import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "./hooks/useGameStore";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { useDiagnosticsBugReport } from "./hooks/useDiagnosticsBugReport";
import Onboarding from "./components/Onboarding";
import GameBoard from "./components/GameBoard";
import MetricsBar from "./components/MetricsBar";
import Settings from "./components/Settings";
import { supabase } from "./lib/supabase";

export default function App() {
  const [view, setView] = useState<"onboarding" | "game">("onboarding");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugDescription, setDebugDescription] = useState("");
  const { startSession, loadProgress } = useGameStore();
  const isOnline = useOnlineStatus();

  const { submitReport, isSubmitting, isSubmitted, submitError, reset } =
    useDiagnosticsBugReport({ feature: "App" });

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase?.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProgress();
      }
    }) ?? { data: { subscription: { unsubscribe: () => {} } } };
    return () => subscription.unsubscribe();
  }, [loadProgress]);

  // Global Ctrl+Shift+D shortcut — opens the hidden debug/bug-report panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setIsDebugOpen((prev) => !prev);
        reset();
        setDebugDescription("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reset]);

  const handleStart = () => {
    startSession();
    setView("game");
  };

  const handleDebugSubmit = useCallback(async () => {
    await submitReport(debugDescription || undefined);
  }, [submitReport, debugDescription]);

  const handleDebugClose = useCallback(() => {
    setIsDebugOpen(false);
    reset();
    setDebugDescription("");
  }, [reset]);

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50/50 to-white font-sans selection:bg-orange-200 selection:text-orange-900">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-100 bg-red-500 text-white text-center py-2 text-sm font-bold tracking-wide shadow-md">
          ⚠️ You&apos;re offline — game features may be limited
        </div>
      )}

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
              <h2 className="text-lg font-black text-gray-800">🐛 Debug Report</h2>
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
                <p className="text-green-600 font-bold text-lg">✅ Report sent!</p>
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
                  Describe what went wrong (optional). Game state and diagnostics
                  will be captured automatically.
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
    </div>
  );
}
