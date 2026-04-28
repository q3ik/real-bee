// TODO: Fix #1 - Broken by merge conflict resolution (current)
// <<<<<<< feat/issue-45-multi-page-routing
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Home } from "lucide-react";
import { motion } from "motion/react";
import { useGameStore } from "../hooks/useGameStore";
import { localDb } from "../lib/db";
import type { LocalSession } from "../lib/db";
import ProgressionOverview from "../components/ProgressionOverview";

/**
 * ResultsPage — session summary.
 *
 * Stats sourced from Zustand store (always fresh after a round) with IndexedDB
 * as fallback for page-refresh scenarios where the store has been reset.
 *
 * Empty-state handling:
 *  - If store has no session data AND IndexedDB has no last session, show
 *    a "No session yet" empty state with a Go Home CTA.
 *  - If store is empty but IndexedDB has data (direct /results navigation
 *    after refresh), show IndexedDB data.
 */
// TODO: Fix #1 - Broken by merge conflict resolution (separator)
// =======
import { useNavigate } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { useGameStore } from "../hooks/useGameStore";
import ProgressionOverview from "../components/ProgressionOverview";

// TODO: Fix #1 - Broken by merge conflict resolution (incoming)
// >>>>>>> trunk
export default function ResultsPage() {
  const navigate = useNavigate();
  const {
    startSession,
    restartGame,
    difficultyEvolution,
    sessionStats,
// TODO: Fix #2 - Broken by merge conflict resolution (current)
// <<<<<<< feat/issue-45-multi-page-routing
    score,
    correctAnswers,
    roundsPlayed,
  } = useGameStore();

  const [lastSession, setLastSession] = useState<LocalSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  // Load the most recently completed session from IndexedDB.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const sessions = await localDb.sessions
          .orderBy("id")
          .reverse()
          .limit(1)
          .toArray();
        if (!cancelled) {
          setLastSession(sessions[0] ?? null);
        }
      } catch {
        // IndexedDB unavailable (e.g. private browsing) — show store data only.
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = sessionStats();

  // hasSession: true if the in-memory store has data OR IndexedDB has a
  // persisted session. This prevents a false "No session yet" empty state
  // when the user navigates directly to /results after a page refresh.
  const storeHasSession = roundsPlayed > 0 || correctAnswers > 0 || score > 0;
  const hasSession = storeHasSession || lastSession !== null;

  // Guard against double-tap: disable "Play Again" while startSession() is
  // in-flight to prevent concurrent calls.
  const handlePlayAgain = useCallback(() => {
    if (isStarting) return;
    setIsStarting(true);
    void startSession()
      .then(() => void navigate("/game"))
      .catch((err: unknown) => {
        console.warn("[ResultsPage] startSession failed", err);
        setIsStarting(false);
      });
  }, [isStarting, startSession, navigate]);

  const handleReset = useCallback(() => {
    restartGame();
    void navigate("/");
  }, [restartGame, navigate]);

  if (!hasSession && !loadingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-12 text-center space-y-6 bg-gradient-to-br from-orange-50 to-white">
        <div className="p-6 bg-orange-100 rounded-full">
          <Trophy className="w-12 h-12 text-orange-400" />
        </div>
        <h2 className="text-2xl font-black text-gray-800">No session yet</h2>
        <p className="text-gray-500">Play a round first to see your results here.</p>
        <button
          onClick={() => void navigate("/")}
          className="px-8 py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg hover:bg-orange-600 transition-all"
        >
          Go Home
// TODO: Fix #2 - Broken by merge conflict resolution (separator)
// =======
    sessionCompleted,
  } = useGameStore();

  const handlePlayAgain = async () => {
    try {
      await startSession();
      navigate("/game");
    } catch (err: unknown) {
      console.warn("[ResultsPage] Play Again: startSession failed", err);
    }
  };

  const handleReset = () => {
    restartGame();
    navigate("/");
  };

  if (!sessionCompleted) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-6">
        <div className="p-6 bg-orange-100 rounded-full">
          <RotateCcw className="w-12 h-12 text-orange-500" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-gray-800 mb-2">
            No Session Results Yet
          </h2>
          <p className="text-gray-500">
            Start a game to see your session summary.
          </p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="px-8 py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg hover:bg-orange-600 transition-all"
        >
          Back Home
// TODO: Fix #2 - Broken by merge conflict resolution (incoming)
// >>>>>>> trunk
        </button>
      </div>
    );
  }

// TODO: Fix #3 - Broken by merge conflict resolution (current)
// <<<<<<< feat/issue-45-multi-page-routing
  // Fall back to lastSession.difficultyEvolution when the in-memory store
  // evolution array is empty (covers page-refresh scenario).
  const evolution =
    Array.isArray(difficultyEvolution) && difficultyEvolution.length > 0
      ? difficultyEvolution
      : (lastSession?.difficultyEvolution ?? []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-orange-50 to-white">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-lg bg-white rounded-[40px] shadow-2xl p-8 md:p-12 border border-orange-100 space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="inline-block p-4 bg-orange-100 rounded-3xl mb-2">
            <Trophy className="w-10 h-10 text-orange-500" />
          </div>
          <h1 className="text-3xl font-black text-gray-800">Session Complete!</h1>
          <p className="text-gray-500">Great job spelling those words!</p>
        </div>

        {lastSession && (
          <div className="text-xs text-center text-gray-400 font-medium">
            {new Date(lastSession.startTime).toLocaleString()}
            {lastSession.endTime && (
              <span> — {new Date(lastSession.endTime).toLocaleString()}</span>
            )}
          </div>
        )}

        <ProgressionOverview evolution={evolution} />

        <div className="space-y-2">
          {stats.map((stat) => (
            <div key={stat.label} className="flex justify-between text-sm">
              <span className="text-gray-500">{stat.label}</span>
              <span className="font-bold text-gray-800">{stat.value}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handlePlayAgain}
            disabled={isStarting}
            className="flex-1 px-6 py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg hover:bg-orange-600 disabled:opacity-50 transition-all"
          >
            {isStarting ? "Starting…" : "Play Again"}
          </button>
          <button
            onClick={handleReset}
            className="p-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
            aria-label="Reset and go home"
          >
            <Home className="w-5 h-5" />
          </button>
          <button
            onClick={() => void navigate("/leaderboard")}
            className="p-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
            aria-label="View leaderboard"
          >
            {/* Trophy icon — RotateCcw was incorrect (looked like replay) */}
            <Trophy className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
// TODO: Fix #3 - Broken by merge conflict resolution (separator)
// =======
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center space-y-8">
      <div className="p-6 bg-orange-100 rounded-full">
        <RotateCcw className="w-12 h-12 text-orange-500" />
      </div>

      <div>
        <h2 className="text-2xl font-black text-gray-800 mb-2">
          Session Complete!
        </h2>
        <p className="text-gray-500">Great job spelling those words!</p>
      </div>

      <div className="w-full max-w-md">
        <ProgressionOverview evolution={difficultyEvolution} />
      </div>

      <div className="space-y-2 w-full max-w-md">
        {sessionStats().map((stat) => (
          <div key={stat.label} className="flex justify-between text-sm">
            <span className="text-gray-500">{stat.label}</span>
            <span className="font-bold text-gray-800">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => {
            void handlePlayAgain();
          }}
          className="px-8 py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg hover:bg-orange-600 transition-all"
        >
          Play Again
        </button>
        <button
          onClick={handleReset}
          className="px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
        >
          Reset
        </button>
      </div>
// TODO: Fix #3 - Broken by merge conflict resolution (incoming)
// >>>>>>> trunk
    </div>
  );
}
