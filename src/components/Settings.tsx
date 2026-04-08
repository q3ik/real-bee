import {
  Volume2,
  VolumeX,
  Zap,
  ShieldCheck,
  Clock,
  X,
  GraduationCap,
  Eye,
  EyeOff,
  Mic,
  Check,
} from "lucide-react";
import { useGameStore } from "../hooks/useGameStore";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { useScrollLock } from "../hooks/useScrollLock";
import { GRADE_OPTIONS, DIFFICULTY_OPTIONS } from "../constants/preferences";
import { motion } from "motion/react";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Settings({ isOpen, onClose }: SettingsProps) {
  // Lock body scroll when modal is open
  useScrollLock(isOpen);

  const {
    isMuted,
    setMuted,
    voiceQuality,
    setVoiceQuality,
    listeningTimeout,
    setListeningTimeout,
    gradeLevel,
    setGradeLevel,
    difficulty,
    setDifficulty,
    showLetterCount,
    toggleLetterCount,
    autoListen,
    toggleAutoListen,
    userId,
  } = useGameStore();

  // useUserPreferences for Dexie persistence
  const {
    soundEnabled: prefSoundEnabled,
    setSoundEnabled,
    autoSubmit,
    setAutoSubmit,
    handleDifficultySelect,
    handleGradeLevelSelect,
  } = useUserPreferences({
    userId,
    onDifficultyChange: (diff) => {
      setDifficulty(diff as "easy" | "medium" | "hard" | "all");
    },
    onGradeLevelChange: (grade) => {
      const gradeValue =
        GRADE_OPTIONS.find((g) => g.prefValue === grade)?.value ?? 1;
      setGradeLevel(gradeValue);
    },
  });

  // Sync soundEnabled between store and preferences
  const effectiveMuted = prefSoundEnabled ? isMuted : true;

  const handleGradeChange = (g: (typeof GRADE_OPTIONS)[number]) => {
    setGradeLevel(g.value);
    handleGradeLevelSelect(g.prefValue);
  };

  const handleDifficultyChange = (d: (typeof DIFFICULTY_OPTIONS)[number]) => {
    setDifficulty(d.value as "easy" | "medium" | "hard" | "all");
    handleDifficultySelect(d.prefValue);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-orange-50/30">
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <Zap className="w-6 h-6 text-orange-500" />
            Game Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* Grade Level */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-50 text-orange-500 rounded-2xl">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-gray-800">Grade Level</p>
                <p className="text-xs text-gray-400">
                  Change word difficulty by grade
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 p-1 bg-gray-50 rounded-2xl">
              {GRADE_OPTIONS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => handleGradeChange(g)}
                  className={`py-2 rounded-xl text-sm font-bold transition-all ${gradeLevel === g.value ? "bg-white shadow-sm text-orange-600" : "text-gray-400"}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-50 text-yellow-500 rounded-2xl">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-gray-800">Difficulty</p>
                <p className="text-xs text-gray-400">Word complexity</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 p-1 bg-gray-50 rounded-2xl">
              {DIFFICULTY_OPTIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => handleDifficultyChange(d)}
                  className={`py-2 rounded-xl text-sm font-bold transition-all ${difficulty === d.value ? "bg-white shadow-sm text-yellow-600" : "text-gray-400"}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Letter Count Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl ${showLetterCount ? "bg-blue-50 text-blue-500" : "bg-gray-100 text-gray-400"}`}
              >
                {showLetterCount ? (
                  <Eye className="w-6 h-6" />
                ) : (
                  <EyeOff className="w-6 h-6" />
                )}
              </div>
              <div>
                <p className="font-bold text-gray-800">Show Word Length</p>
                <p className="text-xs text-gray-400">
                  Display letter placeholders
                </p>
              </div>
            </div>
            <button
              onClick={toggleLetterCount}
              className={`w-14 h-8 rounded-full relative transition-colors ${showLetterCount ? "bg-blue-500" : "bg-gray-200"}`}
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${showLetterCount ? "left-7" : "left-1"}`}
              />
            </button>
          </div>

          {/* Auto Listen Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl ${autoListen ? "bg-orange-50 text-orange-500" : "bg-gray-100 text-gray-400"}`}
              >
                <Mic className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-gray-800">Auto Listen</p>
                <p className="text-xs text-gray-400">
                  Start listening after word is read
                </p>
              </div>
            </div>
            <button
              onClick={toggleAutoListen}
              className={`w-14 h-8 rounded-full relative transition-colors ${autoListen ? "bg-orange-500" : "bg-gray-200"}`}
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${autoListen ? "left-7" : "left-1"}`}
              />
            </button>
          </div>

          {/* Sound Effects Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl ${prefSoundEnabled ? "bg-green-50 text-green-500" : "bg-red-50 text-red-500"}`}
              >
                {prefSoundEnabled ? (
                  <Volume2 className="w-6 h-6" />
                ) : (
                  <VolumeX className="w-6 h-6" />
                )}
              </div>
              <div>
                <p className="font-bold text-gray-800">Sound Effects</p>
                <p className="text-xs text-gray-400">Toggle game sounds</p>
              </div>
            </div>
            <button
              onClick={() => setSoundEnabled(!prefSoundEnabled)}
              className={`w-14 h-8 rounded-full relative transition-colors ${prefSoundEnabled ? "bg-green-500" : "bg-gray-200"}`}
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${prefSoundEnabled ? "left-7" : "left-1"}`}
              />
            </button>
          </div>

          {/* Auto Submit Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl ${autoSubmit ? "bg-purple-50 text-purple-500" : "bg-gray-100 text-gray-400"}`}
              >
                <Check className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-gray-800">Auto Submit</p>
                <p className="text-xs text-gray-400">
                  Auto-submit voice spelling
                </p>
              </div>
            </div>
            <button
              onClick={() => setAutoSubmit(!autoSubmit)}
              className={`w-14 h-8 rounded-full relative transition-colors ${autoSubmit ? "bg-purple-500" : "bg-gray-200"}`}
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${autoSubmit ? "left-7" : "left-1"}`}
              />
            </button>
          </div>

          {/* Voice Quality */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-gray-800">Voice Quality</p>
                <p className="text-xs text-gray-400">
                  Choose how the host sounds
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-50 rounded-2xl">
              <button
                onClick={() => setVoiceQuality("natural")}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${voiceQuality === "natural" ? "bg-white shadow-sm text-blue-600" : "text-gray-400"}`}
              >
                Natural (AI)
              </button>
              <button
                onClick={() => setVoiceQuality("standard")}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${voiceQuality === "standard" ? "bg-white shadow-sm text-blue-600" : "text-gray-400"}`}
              >
                Standard
              </button>
            </div>
          </div>

          {/* Listening Timeout */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-50 text-purple-500 rounded-2xl">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-gray-800">Listening Time</p>
                <p className="text-xs text-gray-400">
                  How long to wait for spelling
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 p-1 bg-gray-50 rounded-2xl">
              {(["normal", "longer", "off"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setListeningTimeout(t)}
                  className={`py-2 rounded-xl text-sm font-bold capitalize transition-all ${listeningTimeout === t ? "bg-white shadow-sm text-purple-600" : "text-gray-400"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
            Real Bee v1.0.0 • Offline Ready
          </p>
        </div>
      </motion.div>
    </div>
  );
}
