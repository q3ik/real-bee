import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
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
 *  - Load user progress once auth initialisation completes
 *  - Show the offline banner when the device has no network
 */
export default function HomePage() {
  const navigate = useNavigate();
  const { startSession, loadProgress, setUserId } = useGameStore();
  const { user, isLoading } = useAuth();
  const isOnline = useOnlineStatus();

  // Track whether the initial post-auth-init load has already fired so we
  // only call loadProgress() once on mount, not on every re-render.
  const initialLoadDone = useRef(false);

  // Effect 1: Once auth initialisation completes, load progress once.
  useEffect(() => {
    if (isLoading || initialLoadDone.current) return;
    initialLoadDone.current = true;
    void loadProgress();
  }, [isLoading, loadProgress]);

  // Effect 2: Sync userId into the store whenever the authenticated identity
  // changes after init, then reload progress under the correct identity.
  useEffect(() => {
    if (isLoading) return;
    if (user) {
      setUserId(user.id);
    } else {
      setUserId(null);
    }
    void loadProgress();
  }, [user, isLoading, loadProgress, setUserId]);

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

      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
