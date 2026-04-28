
// TODO: Fix - POSSIBLY broken by merge conflict resolution

import { useEffect, useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../hooks/useGameStore";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useDiagnosticsBugReport } from "../hooks/useDiagnosticsBugReport";
import { useKeyboardShortcut } from "../hooks/useKeyboardShortcut";
import GameBoard from "../components/GameBoard";
import MetricsBar from "../components/MetricsBar";
import Settings from "../components/Settings";
import DebugReportPanel from "../components/DebugReportPanel";

/**
 * GamePage — active game session.
 *
 * Redirects based on store phase:
 *  - phase === 'completed' → /results (session just finished)
 *  - phase === 'idle' with no currentWord → / (no session; e.g. page refresh)
 *
 * Using phase as the redirect signal is race-condition-free compared to
 * comparing roundsPlayed counters, which can be transiently wrong while
 * sessionBaseline is being reset asynchronously.
 *
 * Note: `user` is intentionally not destructured from useAuth() here —
 * GamePage does not gate on auth state; that is handled by RequireAuth in
 * App.tsx for routes that need it.
 */
export default function GamePage() {
  const navigate = useNavigate();
  const { phase, currentWord } = useGameStore();
  const isOnline = useOnlineStatus();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugDescription, setDebugDescription] = useState("");

  const { submitReport, isSubmitting, isSubmitted, submitError, reset } =
    useDiagnosticsBugReport({ feature: "GamePage" });

  // Guard: redirect based on terminal/absent session phase.
  const hasRedirected = useRef(false);
  useEffect(() => {
    if (hasRedirected.current) return;

    if (phase === "completed") {
      hasRedirected.current = true;
      void navigate("/results", { replace: true });
      return;
    }

    if (phase === "idle" && !currentWord) {
      hasRedirected.current = true;
      void navigate("/", { replace: true });
    }
  }, [phase, currentWord, navigate]);

  // Global Ctrl+Shift+D shortcut — toggles the hidden debug/bug-report panel.
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
      phase: p,
      score,
      streak,
      bestStreak,
      gradeLevel,
      difficulty,
      isMuted,
      roundsPlayed,
      correctAnswers,
      currentWord: cw,
    } = useGameStore.getState();

    await submitReport(debugDescription || undefined, {
      gameState: {
        phase: p,
        score,
        streak,
        bestStreak,
        gradeLevel,
        difficulty,
        isMuted,
        roundsPlayed,
        correctAnswers,
        currentWord: cw?.word ?? null,
      },
    });
  }, [submitReport, debugDescription]);

  const handleDebugClose = useCallback(() => {
    setIsDebugOpen(false);
    reset();
    setDebugDescription("");
  }, [reset]);

  // Don't render the game board until we know whether to redirect.
  // phase is synchronously available from Zustand so this is a single-frame
  // no-op in practice — avoids a flash of empty board before redirect.
  if ((phase === "idle" && !currentWord) || phase === "completed") return null;

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50/50 to-white font-sans selection:bg-orange-200 selection:text-orange-900">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-100 bg-red-500 text-white text-center py-2 text-sm font-bold tracking-wide shadow-md">
          ⚠️ You&apos;re offline — game features may be limited
        </div>
      )}

      <MetricsBar onOpenSettings={() => setIsSettingsOpen(true)} />

      <main className="container mx-auto max-w-4xl">
        <GameBoard />
      </main>

      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <DebugReportPanel
        isOpen={isDebugOpen}
        description={debugDescription}
        onDescriptionChange={setDebugDescription}
        onSubmit={handleDebugSubmit}
        onClose={handleDebugClose}
        isSubmitting={isSubmitting}
        isSubmitted={isSubmitted}
        error={submitError}
      />
    </div>
  );

  return <GameBoard />;
}
