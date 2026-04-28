import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Home } from "lucide-react";
import { motion } from "motion/react";
import { useGameStore } from "../hooks/useGameStore";
import { localDb } from "../lib/db";
import type { LocalSession } from "../lib/db";
import ProgressionOverview from "../components/ProgressionOverview";

function getPersistedSessionStats(session: LocalSession) {
  const accuracy =
    session.wordsSpelled > 0
      ? Math.round((session.correctCount / session.wordsSpelled) * 100)
      : 0;
  const durationMinutes =
    session.endTime != null
      ? Math.max(
          1,
          Math.round(
            (new Date(session.endTime).getTime() -
              new Date(session.startTime).getTime()) /
              60000,
          ),
        )
      : 0;
  const scoreChange = session.scoreChange ?? 0;

  return [
    { label: "Rounds", value: session.wordsSpelled },
    { label: "Accuracy", value: `${accuracy}%` },
    { label: "Best streak", value: session.bestStreak ?? 0 },
    {
      label: "Score change",
      value: scoreChange >= 0 ? `+${scoreChange}` : `${scoreChange}`,
    },
    {
      label: "Time played",
      value: durationMinutes > 0 ? `${durationMinutes}m` : "—",
    },
  ];
}

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
export default function ResultsPage() {
  const navigate = useNavigate();
  const {
    startSession,
    restartGame,
    sessionCompleted,
    difficultyEvolution,
    sessionStats,
  } = useGameStore();

  const [lastSession, setLastSession] = useState<LocalSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (sessionCompleted) {
      setLastSession(null);
      setLoadingSession(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        // Order by startTime (ISO string, lexicographically sortable) rather
        // than id to guarantee recency semantics regardless of insertion order.
        const sessions = await localDb.sessions
          .orderBy("startTime")
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
  }, [sessionCompleted]);

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

  if (!sessionCompleted && loadingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-12 text-center space-y-4 bg-gradient-to-br from-orange-50 to-white">
        <div className="w-12 h-12 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin" />
        <p className="text-sm font-semibold tracking-wide text-gray-500 uppercase">
          Loading results
        </p>
      </div>
    );
  }

  if (!sessionCompleted && !lastSession) {
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
          Back Home
        </button>
      </div>
    );
  }

  const persistedSession = sessionCompleted ? null : lastSession;
  const stats = sessionCompleted
    ? sessionStats()
    : persistedSession
      ? getPersistedSessionStats(persistedSession)
      : [];
  const evolution = sessionCompleted
    ? difficultyEvolution
    : (persistedSession?.difficultyEvolution ?? []);

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

        {persistedSession && (
          <div className="text-xs text-center text-gray-400 font-medium">
            {new Date(persistedSession.startTime).toLocaleString()}
            {persistedSession.endTime && (
              <span> — {new Date(persistedSession.endTime).toLocaleString()}</span>
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
    </div>
  );
}
