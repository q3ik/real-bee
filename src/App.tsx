import { useState, useEffect } from 'react';
import { useGameStore } from './hooks/useGameStore';
import Onboarding from './components/Onboarding';
import GameBoard from './components/GameBoard';
import MetricsBar from './components/MetricsBar';
import Settings from './components/Settings';
import { auth } from './firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

export default function App() {
  const [view, setView] = useState<'onboarding' | 'game'>('onboarding');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { startSession, loadProgress } = useGameStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadProgress();
      }
    });
    return () => unsubscribe();
  }, [loadProgress]);

  const handleStart = () => {
    startSession();
    setView('game');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/50 to-white font-sans selection:bg-orange-200 selection:text-orange-900">
      {view === 'game' && <MetricsBar onOpenSettings={() => setIsSettingsOpen(true)} />}
      
      <main className="container mx-auto max-w-4xl">
        {view === 'onboarding' ? (
          <Onboarding onStart={handleStart} />
        ) : (
          <GameBoard />
        )}
      </main>

      <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
