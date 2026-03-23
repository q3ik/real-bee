import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ProgressionOverviewProps {
  evolution: number[];
}

export default function ProgressionOverview({ evolution }: ProgressionOverviewProps) {
  return (
    <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        Session Progress
      </h3>
      
      <div className="flex items-end gap-1 h-24">
        {evolution.map((val, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: val === 1 ? '100%' : val === -1 ? '40%' : '10%' }}
            className={`flex-1 rounded-t-lg ${val === 1 ? 'bg-green-400' : val === -1 ? 'bg-red-400' : 'bg-gray-200'}`}
          />
        ))}
      </div>
      
      <div className="mt-4 flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
        <span>Start</span>
        <span>End</span>
      </div>
      
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-green-500 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="font-black">Correct</span>
          </div>
          <p className="text-xl font-black text-gray-800">{evolution.filter(v => v === 1).length}</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-red-500 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="font-black">Missed</span>
          </div>
          <p className="text-xl font-black text-gray-800">{evolution.filter(v => v === -1).length}</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
            <Minus className="w-4 h-4" />
            <span className="font-black">Total</span>
          </div>
          <p className="text-xl font-black text-gray-800">{evolution.length}</p>
        </div>
      </div>
    </div>
  );
}
