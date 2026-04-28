// TODO: Fix - Broken by merge conflict resolution (current)
// <<<<<<< feat/issue-45-multi-page-routing
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, ArrowLeft } from "lucide-react";
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
 * component always renders with a non-null user. The secondary useEffect
 * guard below is belt-and-suspenders for direct imports in tests.
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

  // Only block render while auth is still resolving. Once auth is done,
  // RequireAuth in App.tsx guarantees user is non-null, so we never reach
  // this component unauthenticated in normal flow.
  if (authLoading) return null;

  return (
    <div className="min-h-screen flex flex-col items-center p-6 bg-gradient-to-br from-orange-50 to-white">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 pt-6">
          <button
            onClick={() =>
              window.history.length > 1
                ? void navigate(-1)
                : void navigate("/")
            }
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
// TODO: Fix - Broken by merge conflict resolution (separator)
// =======
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Cloud, HardDrive, RefreshCw, Trophy } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { localDb, type LocalUserProgress, type LocalSession } from "../lib/db";
import { supabase } from "../lib/supabase";

interface LeaderboardEntry {
  key: string;
  uid: string;
  name: string;
  score: number;
  bestStreak?: number;
  sessionsPlayed?: number;
  updatedAt?: string;
}

interface SupabaseProgressRow {
  user_id: string;
  data: unknown;
  timestamp: string;
}

function parseScore(data: unknown): number {
  if (!data) return 0;

  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as Record<string, unknown>;
      return typeof parsed.score === "number" ? parsed.score : 0;
    } catch {
      return 0;
    }
  }

  if (typeof data === "object") {
    const maybeObj = data as Record<string, unknown>;
    return typeof maybeObj.score === "number" ? maybeObj.score : 0;
  }

  return 0;
}

function rankColor(rank: number): string {
  if (rank === 1) return "text-yellow-500";
  if (rank === 2) return "text-gray-400";
  if (rank === 3) return "text-amber-700";
  return "text-gray-500";
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [localRows, setLocalRows] = useState<LeaderboardEntry[]>([]);
  const [cloudRows, setCloudRows] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setErrorText(null);

    try {
      const [progressRows, sessionRows] = await Promise.all([
        localDb.progress.toArray(),
        localDb.sessions.toArray(),
      ]);

      const sessionsByUid = sessionRows.reduce<Record<string, LocalSession[]>>(
        (acc, session) => {
          if (!acc[session.uid]) acc[session.uid] = [];
          acc[session.uid].push(session);
          return acc;
        },
        {},
      );

      const localEntries = progressRows
        .map((row: LocalUserProgress) => {
          const isYou = user?.id === row.uid;
          return {
            key: `local-${row.uid}`,
            uid: row.uid,
            name: isYou ? "You" : `Player ${row.uid.slice(0, 6)}`,
            score: row.score,
            bestStreak: row.bestStreak,
            sessionsPlayed: sessionsByUid[row.uid]?.length ?? 0,
            updatedAt: row.lastPlayed,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      setLocalRows(localEntries);

      if (supabase && user) {
        const { data, error } = await supabase
          .from("user_progress")
          .select("user_id, data, timestamp")
          .eq("type", "progress")
          .order("timestamp", { ascending: false })
          .limit(200);

        if (error) throw error;

        const bestByUser = new Map<string, LeaderboardEntry>();

        (data as SupabaseProgressRow[] | null)?.forEach((row) => {
          const score = parseScore(row.data);
          const existing = bestByUser.get(row.user_id);
          const current: LeaderboardEntry = {
            key: `cloud-${row.user_id}`,
            uid: row.user_id,
            name: row.user_id === user.id ? "You" : `Player ${row.user_id.slice(0, 6)}`,
            score,
            updatedAt: row.timestamp,
          };

          if (!existing || current.score > existing.score) {
            bestByUser.set(row.user_id, current);
          }
        });

        const cloudEntries = [...bestByUser.values()]
          .sort((a, b) => b.score - a.score)
          .slice(0, 20);

        setCloudRows(cloudEntries);
      } else {
        setCloudRows([]);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load leaderboard data.";
      setErrorText(message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const mergedTop3 = useMemo(() => {
    const source = cloudRows.length > 0 ? cloudRows : localRows;
    return source.slice(0, 3);
  }, [cloudRows, localRows]);

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-orange-50 to-white">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-orange-100 text-gray-600 hover:bg-orange-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back Home
          </button>

          <button
            onClick={() => void loadLeaderboard()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-orange-100 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-2xl bg-orange-100">
              <Trophy className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-gray-800">Leaderboard</h1>
              <p className="text-sm text-gray-500">
                Local rankings from Dexie + cloud rankings from Supabase.
              </p>
            </div>
          </div>

          {errorText && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
              {errorText}
            </div>
          )}

          {isLoading ? (
            <div className="mt-8 text-center text-gray-500 font-semibold">Loading leaderboard…</div>
          ) : (
            <>
              {mergedTop3.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                  {mergedTop3.map((entry, idx) => (
                    <div
                      key={`podium-${entry.key}`}
                      className="rounded-2xl border border-orange-100 bg-orange-50/50 p-4 text-center"
                    >
                      <p className={`text-xl font-black ${rankColor(idx + 1)}`}>#{idx + 1}</p>
                      <p className="font-bold text-gray-800 truncate">{entry.name}</p>
                      <p className="text-orange-600 font-black text-lg">{entry.score} pts</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
                <section className="rounded-2xl border border-orange-100 bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b border-orange-50 bg-orange-50/60 flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-orange-500" />
                    <h2 className="font-bold text-gray-800">Local (Dexie)</h2>
                  </div>
                  <div className="p-2">
                    {localRows.length === 0 ? (
                      <p className="p-4 text-sm text-gray-500">No local progress yet.</p>
                    ) : (
                      localRows.map((entry, idx) => (
                        <div
                          key={entry.key}
                          className="grid grid-cols-[40px_1fr_auto] items-center gap-3 px-3 py-2 rounded-xl hover:bg-orange-50/50"
                        >
                          <span className={`font-black ${rankColor(idx + 1)}`}>#{idx + 1}</span>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{entry.name}</p>
                            <p className="text-xs text-gray-500">
                              Streak {entry.bestStreak ?? 0} • Sessions {entry.sessionsPlayed ?? 0}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-orange-600">{entry.score}</p>
                            <p className="text-[10px] text-gray-400">{formatDate(entry.updatedAt)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-orange-100 bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b border-orange-50 bg-orange-50/60 flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-orange-500" />
                    <h2 className="font-bold text-gray-800">Cloud (Supabase)</h2>
                  </div>
                  <div className="p-2">
                    {cloudRows.length === 0 ? (
                      <p className="p-4 text-sm text-gray-500">
                        {user
                          ? "No cloud scores available yet."
                          : "Sign in to view cloud rankings."}
                      </p>
                    ) : (
                      cloudRows.map((entry, idx) => (
                        <div
                          key={entry.key}
                          className="grid grid-cols-[40px_1fr_auto] items-center gap-3 px-3 py-2 rounded-xl hover:bg-orange-50/50"
                        >
                          <span className={`font-black ${rankColor(idx + 1)}`}>#{idx + 1}</span>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{entry.name}</p>
                            {user?.id === entry.uid && (
                              <p className="text-xs text-gray-500">Your account</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-black text-orange-600">{entry.score}</p>
                            <p className="text-[10px] text-gray-400">{formatDate(entry.updatedAt)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
// TODO: Fix - Broken by merge conflict resolution (incoming)
// >>>>>>> trunk
      </div>
    </div>
  );
}
