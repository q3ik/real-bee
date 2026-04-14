import { type Word } from "../lib/wordList";
import { type Hint } from "../hooks/useHints.types";
import { HelpCircle, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MAX_HINTS_PER_WORD } from "../constants/game";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HintSystemProps {
  word: Word;
  hints: Hint[];
  onGetHint: () => void;
}

const hintBadgeColors: Record<string, string> = {
  vowel: "bg-blue-100 text-blue-700 border-blue-200",
  double: "bg-purple-100 text-purple-700 border-purple-200",
  length: "bg-gray-100 text-gray-700 border-gray-200",
  first: "bg-green-100 text-green-700 border-green-200",
  last: "bg-amber-100 text-amber-700 border-amber-200",
  syllables: "bg-cyan-100 text-cyan-700 border-cyan-200",
};

export default function HintSystem({
  word,
  hints,
  onGetHint,
}: HintSystemProps) {
  return (
    <div className="mt-6 w-full max-w-md mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          Hints
        </h3>
        {hints.length < MAX_HINTS_PER_WORD && (
          <Button
            variant="link"
            size="sm"
            onClick={onGetHint}
            className={cn(
              "text-xs font-bold text-primary hover:text-primary/80 p-0 h-auto",
            )}
          >
            Get Hint <ChevronRight className="w-3 h-3 ml-0.5" />
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {hints.map((hint, i) => (
            <motion.div
              key={`${i}-${hint.type}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className={cn("p-3 border text-sm")}>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "capitalize text-xs",
                      hintBadgeColors[hint.type] ?? "bg-gray-100 text-gray-700",
                    )}
                  >
                    {hint.type}
                  </Badge>
                  <span className="text-gray-700 italic">{hint.text}</span>
                </div>
              </Card>
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
