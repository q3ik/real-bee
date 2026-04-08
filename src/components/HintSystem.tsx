import { type Word } from "../lib/wordList";
import { type Hint } from "../hooks/useHints.types";
import { HelpCircle, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface HintSystemProps {
  word: Word;
  hints: Hint[];
  onGetHint: () => void;
}

export default function HintSystem({
  word,
  hints,
  onGetHint,
}: HintSystemProps) {
  const maxHints = 4;

  return (
    <div className="mt-6 w-full max-w-md mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          Hints
        </h3>
        {hints.length < maxHints && (
          <button
            onClick={onGetHint}
            className="text-xs font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1 bg-orange-50 px-2 py-1 rounded-full transition-all"
          >
            Get Hint <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {hints.map((hint, i) => (
            <motion.div
              key={`${i}-${hint.type}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-orange-50/50 border border-orange-100 rounded-xl text-sm"
            >
              <span className="font-bold text-orange-600 mr-2 capitalize">
                {hint.type}:
              </span>
              <span className="text-gray-700 italic">{hint.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {hints.length === 0 && (
          <div className="text-center py-4 text-gray-400 text-xs italic">
            Need a little help? Click &quot;Get Hint&quot; above!
          </div>
        )}
      </div>
    </div>
  );
}
