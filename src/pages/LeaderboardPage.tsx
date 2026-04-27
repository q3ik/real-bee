import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, ArrowLeft, LogIn } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface LeaderboardEntry {
  uid: string;
  display_name: string | null;
  score: number;
  best_streak: number;
  mastered_count: number;
}

/**
 * LeaderboardPage — top scores from Supabase.
 *
 * Auth-gated: the route is wrapped in <RequireAuth> in App.tsx so this
 * component always renders with a non-null user. The guard here is a
 * secondary safety net for direct imports in tests.
 *
 * Data is fetched from the `leaderboard` view in Supabase (public, read-only).
 * If the view does not exist yet, the empty-state is shown gracefully.
 */
export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Secondary auth guard (belt-and-suspenders alongside RequireAuth in App).
  useEffect(() => {
    if (!authLoading && !user) {
      void navigate("/", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    void (async () => {
      try {
        const { data, error: sbError } = await supabase
          .from("leaderboard")
          .select("uid, display_name, score, best_streak, mastered_count")
          .order("score", { ascending: false })
          .limit(50);

        if (sbError) throw sbError;
        if (!cancelled) setEntries((data as LeaderboardEntry[]) ?? []);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load leaderboard",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  if (authLoading || (!user && !authLoading)) return null;

  return (
    <div className="min-h-screen flex flex-col items-center p-6 bg-gradient-to-br from-orange-50 to-white">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 pt-6">
          <button
            onClick={() => void navigate(-1)}
            className="p-2 rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-gray-600 transition-colors shadow-sm"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-2xl">
              <Trophy className="w-6 h-6 text-orange-500" />
            </div>
            <h1 className="text-2xl font-black text-gray-800">Leaderboard</h1>
          </div>
        </div>

        {/* Signed-in context */}
        {user && (
          <p className="text-xs text-gray-400 text-center">
            Signed in as{" "}
            <span className="font-bold text-gray-600">
              {user.user_metadata?.full_name ?? user.email ?? "Speller"}
            </span>
          </p>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center text-red-600 text-sm font-bold">
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center space-y-4">
            <div className="p-6 bg-orange-50 rounded-full">
              <Trophy className="w-10 h-10 text-orange-300" />
            </div>
            <h2 className="text-xl font-black text-gray-700">No scores yet</h2>
            <p className="text-gray-400 text-sm">
              Be the first to make the board!
            </p>
            <button
              onClick={() => void navigate("/")}
              className="px-6 py-3 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all"
            >
              Play Now
            </button>
          </div>
        ) : (
          <motion.ol
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {entries.map((entry, idx) => (
              <motion.li
                key={entry.uid}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: idx * 0.04 }}
                className={`flex items-center gap-4 bg-white rounded-2xl px-5 py-4 border ${
                  idx === 0
                    ? "border-orange-200 shadow-md"
                    : "border-gray-100 shadow-sm"
                }`}
              >
                <span
                  className={`w-8 h-8 flex items-center justify-center rounded-full font-black text-sm shrink-0 ${
                    idx === 0
                      ? "bg-orange-500 text-white"
                      : idx === 1
                        ? "bg-gray-300 text-gray-700"
                        : idx === 2
                          ? "bg-amber-600 text-white"
                          : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 truncate">
                    {entry.display_name ?? "Anonymous Speller"}
                  </p>
                  <p className="text-xs text-gray-400">
                    Streak {entry.best_streak} · {entry.mastered_count} mastered
                  </p>
                </div>
                <span className="font-black text-orange-500 tabular-nums">
                  {entry.score.toLocaleString()}
                </span>
              </motion.li>
            ))}
          </motion.ol>
        )}

        {/* Sign-in nudge for unauthenticated edge case */}
        {!user && !authLoading && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <LogIn className="w-8 h-8 text-gray-300" />
            <p className="text-gray-500 text-sm">
              Sign in to see the leaderboard
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
