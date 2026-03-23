import { Trophy, Flame, CheckCircle, Settings as SettingsIcon } from 'lucide-react';
import { useGameStore } from '../hooks/useGameStore';

interface MetricsBarProps {
  onOpenSettings: () => void;
}

export default function MetricsBar({ onOpenSettings }: MetricsBarProps) {
  const { score, streak, masteredCount } = useGameStore();

  return (
    <div className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-md border-b border-orange-100 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <span className="font-bold text-gray-700">{score}</span>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Score</span>
        </div>
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          <span className="font-bold text-gray-700">{streak}</span>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Streak</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <span className="font-bold text-gray-700">{masteredCount}</span>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Mastered</span>
        </div>
      </div>
      
      <button 
        onClick={onOpenSettings}
        className="p-2 hover:bg-orange-50 rounded-full transition-colors group"
      >
        <SettingsIcon className="w-6 h-6 text-gray-400 group-hover:text-orange-500 transition-colors" />
      </button>
    </div>
  );
}
