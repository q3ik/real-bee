import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useGameStore } from "../hooks/useGameStore";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useDiagnosticsBugReport } from "../hooks/useDiagnosticsBugReport";
import { useKeyboardShortcut } from "../hooks/useKeyboardShortcut";
import Settings from "./Settings";
import PwaInstallPrompt from "./PwaInstallPrompt";
import MetricsBar from "./MetricsBar";

interface AppLayoutProps {
  children: ReactNode;
  mainClassName?: string;
}

export default function AppLayout({
  children,
  mainClassName = "container mx-auto max-w-4xl",
}: AppLayoutProps) {
  const location = useLocation();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugDescription, setDebugDescription] = useState("");

  const { loadProgress, setUserId } = useGameStore();
  const { user, isLoading } = useAuth();
  const isOnline = useOnlineStatus();

  const { submitReport, isSubmitting, isSubmitted, submitError, reset } =
    useDiagnosticsBugReport({ feature: "App" });

  // Track the last user ID we've synced so we only re-run when identity
  // actually changes, not on every render where isLoading flips.
  const syncedUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Wait for auth to finish initialising before touching the store.
    if (isLoading) return;

    const incomingId = user?.id ?? null;

    // Skip if we already synced this exact identity (covers both the initial
    // mount and any re-renders that don't change the user).
    if (syncedUserIdRef.current === incomingId) return;

    syncedUserIdRef.current = incomingId;
    setUserId(incomingId);
    void loadProgress();
  }, [isLoading, user?.id, setUserId, loadProgress]);

  useKeyboardShortcut(
    "D",
    useCallback(() => {
      setIsDebugOpen((prev) => {
        const opening = !prev;
        if (opening) {
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

  const handleDebugSubmit = useCallback(async () => {
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

  const showMetricsBar = location.pathname === "/game";

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50/50 to-white font-sans selection:bg-orange-200 selection:text-orange-900">
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-100 bg-red-500 text-white text-center py-2 text-sm font-bold tracking-wide shadow-md">
          ⚠️ You&apos;re offline — game features may be limited
        </div>
      )}

      <PwaInstallPrompt />

      {showMetricsBar && (
        <MetricsBar onOpenSettings={() => setIsSettingsOpen(true)} />
      )}

      <main className={mainClassName}>{children}</main>

      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

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

      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
