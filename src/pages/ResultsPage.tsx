import { useNavigate } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { useGameStore } from "../hooks/useGameStore";
import ProgressionOverview from "../components/ProgressionOverview";

export default function ResultsPage() {
  const navigate = useNavigate();
  const {
    startSession,
    restartGame,
    difficultyEvolution,
    sessionStats,
    sessionCompleted,
  } = useGameStore();

  const hasCompletedSession = sessionCompleted;

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

  if (!hasCompletedSession) {
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
        </button>
      </div>
    );
  }

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
    </div>
  );
}
