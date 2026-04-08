import { useState, useEffect } from "react";
import { useGameStore } from "./hooks/useGameStore";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import Onboarding from "./components/Onboarding";
import GameBoard from "./components/GameBoard";
import MetricsBar from "./components/MetricsBar";
import Settings from "./components/Settings";
import { supabase } from "./lib/supabase";

export default function App() {
  const [view, setView] = useState<"onboarding" | "game">("onboarding");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { startSession, loadProgress } = useGameStore();
  const isOnline = useOnlineStatus();

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

  const handleStart = () => {
    startSession();
    setView("game");
  };

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
    </div>
  );
}
