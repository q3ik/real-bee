// TODO: Fix - Broken by merge conflict resolution (current)
// <<<<<<< feat/issue-45-multi-page-routing
import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../hooks/useGameStore";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useAuth } from "../contexts/AuthContext";
import Onboarding from "../components/Onboarding";
import PwaInstallPrompt from "../components/PwaInstallPrompt";

/**
 * HomePage — grade selector + start game CTA.
 *
 * Responsibilities:
 *  - Render the Onboarding component (grade/difficulty selectors)
 *  - On "Start Playing", call startSession() then navigate to /game
 *  - Load user progress once auth initialisation completes (single effect
 *    keyed on user?.id to prevent double-firing on mount)
 *  - Show the offline banner when the device has no network
 *
 * Note: <Toaster> lives in App.tsx (global). Do not add a second instance here.
 */
export default function HomePage() {
  const navigate = useNavigate();
  const { startSession, loadProgress, setUserId } = useGameStore();
  const { user, isLoading } = useAuth();
  const isOnline = useOnlineStatus();

  // Single effect: fires once auth initialisation completes (isLoading → false),
  // then re-fires only when the authenticated identity (user?.id) changes.
  // This replaces the previous two-effect pattern that called loadProgress()
  // twice on mount (once in Effect 1, once in Effect 2).
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (isLoading) return;

    const currentUserId = user?.id ?? null;

    // Sync userId into the store unconditionally.
    setUserId(currentUserId);

    // Only reload progress when the identity has actually changed (including
    // the first run where prevUserIdRef is undefined).
    if (prevUserIdRef.current !== currentUserId) {
      prevUserIdRef.current = currentUserId;
      void loadProgress();
    }
  }, [isLoading, user?.id, loadProgress, setUserId]);

  const handleStart = useCallback(() => {
    void startSession()
      .then(() => {
        void navigate("/game");
      })
      .catch((err: unknown) => {
        console.warn("[HomePage] startSession failed", err);
      });
  }, [startSession, navigate]);

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50/50 to-white font-sans selection:bg-orange-200 selection:text-orange-900">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-100 bg-red-500 text-white text-center py-2 text-sm font-bold tracking-wide shadow-md">
          ⚠️ You&apos;re offline — game features may be limited
        </div>
      )}

      <PwaInstallPrompt />

      <main className="container mx-auto max-w-4xl">
        <Onboarding onStart={handleStart} />
      </main>
    </div>
  );
// TODO: Fix - Broken by merge conflict resolution (separator)
// =======
import { useNavigate } from "react-router-dom";
import Onboarding from "../components/Onboarding";
import { useGameStore } from "../hooks/useGameStore";

export default function HomePage() {
  const navigate = useNavigate();
  const { startSession } = useGameStore();

  const handleStart = async () => {
    try {
      await startSession();
      navigate("/game");
    } catch (err: unknown) {
      console.warn("[HomePage] handleStart: startSession failed", err);
    }
  };

  return <Onboarding onStart={() => { void handleStart(); }} />;
// TODO: Fix - Broken by merge conflict resolution (incoming)
// >>>>>>> trunk
}
