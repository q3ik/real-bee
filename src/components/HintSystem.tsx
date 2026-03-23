import { useState } from 'react';
import { HelpCircle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { type Word } from '../lib/wordList';
import { audioManager } from '../lib/audioManager';

interface HintSystemProps {
  word: Word;
}

export default function HintSystem({ word }: HintSystemProps) {
  const [hintLevel, setHintLevel] = useState(0);

  const hints = [
    { label: 'Definition', content: word.definition, spoken: word.definition },
    { label: 'Sentence', content: word.sentence.replace(new RegExp(word.word, 'gi'), '_____'), spoken: word.sentence },
    { label: 'Length', content: `${word.word.length} letters`, spoken: `The word has ${word.word.length} letters` },
    { label: 'First Letter', content: `Starts with: ${word.word[0].toUpperCase()}`, spoken: `The word starts with ${word.word[0].toUpperCase()}` },
  ];

  return (
    <div className="mt-6 w-full max-w-md mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          Hints
        </h3>
        {hintLevel < hints.length && (
          <button 
            onClick={() => {
              const nextLevel = hintLevel + 1;
              setHintLevel(nextLevel);
              audioManager.speak(hints[nextLevel - 1].spoken);
            }}
            className="text-xs font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1 bg-orange-50 px-2 py-1 rounded-full transition-all"
          >
            Get Hint <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {hints.slice(0, hintLevel).map((hint, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-orange-50/50 border border-orange-100 rounded-xl text-sm"
            >
              <span className="font-bold text-orange-600 mr-2">{hint.label}:</span>
              <span className="text-gray-700 italic">{hint.content}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {hintLevel === 0 && (
          <div className="text-center py-4 text-gray-400 text-xs italic">
            Need a little help? Click "Get Hint" above!
          </div>
        )}
      </div>
    </div>
  );
}
