import { useState, useEffect, useRef, useCallback } from "react";
import {
  Volume2,
  Mic,
  Keyboard,
  RotateCcw,
  Check,
  X,
  AlertCircle,
  MessageCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useGameStore } from "../hooks/useGameStore";
import { useVoiceRecognition } from "../hooks/useVoiceRecognition";
import { useCountdown } from "../hooks/useCountdown";
import { useHints } from "../hooks/useHints";
import { useHostMessages } from "../hooks/useHostMessages";
import { useGameKeyboardShortcuts } from "../hooks/useGameKeyboardShortcuts";
import { audioManager } from "../lib/audioManager";
import HintSystem from "./HintSystem";
import ProgressionOverview from "./ProgressionOverview";

const ROUND_DURATION_MS = 30_000; // 30 seconds per round

export default function GameBoard() {
  const {
    currentWord,
    phase,
    result,
    submitAnswer,
    timeoutRound,
    nextWord,
    startSession,
    restartGame,
    isMuted,
    voiceQuality,
    listeningTimeout,
    difficultyEvolution,
    showLetterCount,
    autoListen,
    sessionStats,
  } = useGameStore();

  const [userInput, setUserInput] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const lastSpokenWordRef = useRef<string | null>(null);

  // Host messages (game narration transcript)
  const { messages, addMessage, clearMessages } = useHostMessages();

  // Hints for the current word
  const { hints, addHint, clearHints } = useHints();

  // Countdown timer — triggers round end when time expires
  const {
    remaining,
    percent: timePercent,
    start: startCountdown,
    stop: stopCountdown,
    reset: resetCountdown,
  } = useCountdown(ROUND_DURATION_MS, {
    onComplete: () => {
      // Time's up — record timeout in store, stop voice, show result and move on
      timeoutRound();
      stopListening();
      if (currentWord) {
        addMessage("system", `Time's up! The word was: ${currentWord.word}`);
        audioManager.speak(`Time's up! The word was ${currentWord.word}`);
      }
      setFeedback("incorrect");
      setTimeout(() => {
        setFeedback(null);
        nextWord();
        setUserInput("");
      }, 2000);
    },
  });

  const { isListening, transcript, timeLeft, startListening, stopListening } =
    useVoiceRecognition({
      targetWord: currentWord?.word,
      timeout:
        listeningTimeout === "longer"
          ? 15000
          : listeningTimeout === "off"
            ? 60000
            : 10000,
      onTranscript: (t) => setError(null),
      onResult: (res) => handleSubmission(res),
      onError: (err) => setError(err),
    });

  // Auto-speak the word when it changes
  useEffect(() => {
    if (
      currentWord &&
      phase === "playing" &&
      lastSpokenWordRef.current !== currentWord.word
    ) {
      const speakAndListen = async () => {
        await audioManager.speak(currentWord.word);
        if (autoListen) {
          startListening();
        }
      };
      speakAndListen();
      lastSpokenWordRef.current = currentWord.word;
      addMessage("word", currentWord.word);
    }
  }, [currentWord, phase, autoListen, startListening, addMessage]);

  // Start countdown when a new round begins
  useEffect(() => {
    if (phase === "playing" && currentWord) {
      startCountdown();
    } else {
      stopCountdown();
    }
  }, [phase, currentWord, startCountdown, stopCountdown]);

  // Clear hints/messages when session restarts
  useEffect(() => {
    if (phase === "idle") {
      clearHints();
      clearMessages();
    }
  }, [phase, clearHints, clearMessages]);

  const handleSubmission = useCallback(
    (val: string) => {
      // Guard against duplicate submissions (e.g., voice result arriving during overlay)
      if (phase !== "playing") return;

      const isCorrect = submitAnswer(val);
      setFeedback(isCorrect ? "correct" : "incorrect");
      audioManager.playEffect(isCorrect ? "correct" : "incorrect");

      if (isCorrect) {
        addMessage(
          "player",
          `Spelled: ${val.toUpperCase().split("").join("-")}`,
        );
      }

      setTimeout(() => {
        setFeedback(null);
        nextWord();
        setUserInput("");
      }, 2000);
    },
    [phase, submitAnswer, addMessage, nextWord],
  );

  // Keyboard shortcuts
  const handleHint = useCallback(() => {
    if (currentWord) {
      const hint = addHint({
        word: currentWord.word,
        definition: currentWord.definition,
        sentence: currentWord.sentence,
      });
      if (hint) {
        audioManager.speak(hint.spokenText ?? hint.text);
        addMessage("system", hint.text);
      }
    }
  }, [currentWord, addHint, addMessage]);

  const handleDefinition = useCallback(() => {
    if (currentWord) {
      audioManager.speak(currentWord.definition);
      addMessage("definition", currentWord.definition);
    }
  }, [currentWord, addMessage]);

  const handleSentence = useCallback(() => {
    if (currentWord) {
      audioManager.speak(currentWord.sentence);
      addMessage("sentence", currentWord.sentence);
    }
  }, [currentWord, addMessage]);

  useGameKeyboardShortcuts({
    gameState: phase,
    onRepeatWord: () => {
      if (currentWord) {
        audioManager.speak(currentWord.word);
      }
    },
    onHint: handleHint,
    onDefinition: handleDefinition,
    onSentence: handleSentence,
  });

  if (phase === "idle" && !currentWord) {
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
            onClick={startSession}
            className="px-8 py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg hover:bg-orange-600 transition-all"
          >
            Play Again
          </button>
          <button
            onClick={restartGame}
            className="px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
          >
            Reset
          </button>
        </div>
      </div>
    );
  }

  if (!currentWord) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <button
          onClick={startSession}
          className="px-8 py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg hover:bg-orange-600 transition-all"
        >
          Start Session
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      {/* Host Messages Transcript */}
      {messages.length > 0 && (
        <div className="bg-white/60 rounded-2xl p-4 border border-orange-50 max-h-32 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Host
            </span>
          </div>
          <div className="space-y-1">
            {messages.slice(-3).map((msg, i) => (
              <p key={i} className="text-sm text-gray-600 italic">
                {msg.text}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Center Stage: The Card */}
      <motion.div
        key={currentWord.word}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[40px] shadow-xl p-10 border border-orange-50 text-center relative overflow-hidden"
      >
        {/* Feedback Overlay */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-md ${feedback === "correct" ? "bg-green-500/90" : "bg-red-500/90"}`}
            >
              <motion.div
                initial={{ scale: 0.5, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                className="bg-white p-6 rounded-full shadow-2xl mb-4"
              >
                {feedback === "correct" ? (
                  <Check className="w-16 h-16 text-green-500" />
                ) : (
                  <X className="w-16 h-16 text-red-500" />
                )}
              </motion.div>
              <h2 className="text-3xl font-black text-white uppercase tracking-widest">
                {feedback === "correct" ? "Awesome!" : "Try Again!"}
              </h2>
              {feedback === "incorrect" && (
                <p className="text-white/80 font-bold mt-2">
                  The word was: {currentWord.word}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Countdown Timer Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-100">
          <motion.div
            className="h-full bg-orange-500"
            animate={{ width: `${timePercent}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        <button
          onClick={() => audioManager.speak(currentWord.word)}
          className="p-8 bg-orange-500 text-white rounded-full shadow-2xl shadow-orange-200 hover:scale-105 transition-transform active:scale-95 mb-10"
        >
          <Volume2 className="w-12 h-12" />
        </button>

        <div className="flex justify-center gap-3 mb-10 min-h-[48px]">
          {showLetterCount ? (
            currentWord.word.split("").map((_, i) => (
              <div
                key={i}
                className="w-8 h-12 border-b-4 border-gray-200 flex items-center justify-center text-2xl font-black text-gray-400"
              >
                _
              </div>
            ))
          ) : (
            <div className="text-gray-300 italic text-sm font-bold uppercase tracking-widest">
              Word length hidden
            </div>
          )}
        </div>

        <HintSystem
          word={currentWord}
          hints={hints}
          onGetHint={() => {
            const hint = addHint({
              word: currentWord.word,
              definition: currentWord.definition,
              sentence: currentWord.sentence,
            });
            if (hint) {
              audioManager.speak(hint.spokenText ?? hint.text);
              addMessage("system", hint.text);
            }
          }}
        />
      </motion.div>

      {/* Input Area */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <button
            onClick={isListening ? stopListening : startListening}
            className={`flex-1 py-6 rounded-[24px] font-black text-xl flex items-center justify-center gap-3 transition-all shadow-xl ${isListening ? "bg-red-500 text-white animate-pulse" : "bg-orange-500 text-white hover:bg-orange-600 shadow-orange-100"}`}
          >
            <Mic className="w-6 h-6" />
            {isListening ? "Listening..." : "Spell by Voice"}
          </button>

          <button
            onClick={() => setShowKeyboard(!showKeyboard)}
            className={`p-6 rounded-[24px] transition-all border-2 ${showKeyboard ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-400 border-gray-100"}`}
          >
            <Keyboard className="w-8 h-8" />
          </button>
        </div>

        {/* Live Transcript & Timer */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-white rounded-3xl p-6 border border-orange-100 shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Live Transcript
                </span>
                <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-orange-500"
                    initial={{ width: "100%" }}
                    animate={{ width: `${timeLeft}%` }}
                  />
                </div>
              </div>
              <p className="text-2xl font-black text-gray-800 text-center tracking-widest uppercase">
                {transcript || "..."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Keyboard Input */}
        <AnimatePresence>
          {showKeyboard && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-3"
            >
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  userInput.trim() &&
                  handleSubmission(userInput)
                }
                placeholder="Type spelling here..."
                className="w-full p-6 rounded-[24px] border-2 border-gray-100 focus:border-orange-500 outline-none font-black text-xl text-center uppercase tracking-widest"
                autoFocus
              />
              <button
                onClick={() => userInput.trim() && handleSubmission(userInput)}
                className="w-full py-4 bg-gray-800 text-white rounded-2xl font-bold hover:bg-gray-900 transition-all"
              >
                Submit Spelling
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
