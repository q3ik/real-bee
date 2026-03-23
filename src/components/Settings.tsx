import { useState } from 'react';
import { Volume2, VolumeX, Zap, ShieldCheck, Clock, X, GraduationCap, Eye, EyeOff, Mic } from 'lucide-react';
import { useGameStore } from '../hooks/useGameStore';
import { motion } from 'motion/react';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const { 
    isMuted, toggleMute, 
    voiceQuality, setVoiceQuality,
    listeningTimeout, setListeningTimeout,
    gradeLevel, setGradeLevel,
    difficulty, setDifficulty,
    showLetterCount, toggleLetterCount,
    autoListen, toggleAutoListen
  } = useGameStore();

  const grades = [
    { label: 'K-2', value: 1 },
    { label: '3-5', value: 3 },
    { label: '6-8', value: 6 },
    { label: 'All', value: 0 },
  ];

  const difficulties = [
    { label: 'Easy', value: 'easy' },
    { label: 'Medium', value: 'medium' },
    { label: 'Hard', value: 'hard' },
    { label: 'Mixed', value: 'all' },
  ];

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
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
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
                <p className="text-xs text-gray-400">Change word difficulty by grade</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 p-1 bg-gray-50 rounded-2xl">
              {grades.map((g) => (
                <button 
                  key={g.value}
                  onClick={() => setGradeLevel(g.value)}
                  className={`py-2 rounded-xl text-sm font-bold transition-all ${gradeLevel === g.value ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400'}`}
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
              {difficulties.map((d) => (
                <button 
                  key={d.value}
                  onClick={() => setDifficulty(d.value as any)}
                  className={`py-2 rounded-xl text-sm font-bold transition-all ${difficulty === d.value ? 'bg-white shadow-sm text-yellow-600' : 'text-gray-400'}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Letter Count Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${showLetterCount ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-400'}`}>
                {showLetterCount ? <Eye className="w-6 h-6" /> : <EyeOff className="w-6 h-6" />}
              </div>
              <div>
                <p className="font-bold text-gray-800">Show Word Length</p>
                <p className="text-xs text-gray-400">Display letter placeholders</p>
              </div>
            </div>
            <button 
              onClick={toggleLetterCount}
              className={`w-14 h-8 rounded-full relative transition-colors ${showLetterCount ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${showLetterCount ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          {/* Auto Listen Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${autoListen ? 'bg-orange-50 text-orange-500' : 'bg-gray-100 text-gray-400'}`}>
                <Mic className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-gray-800">Auto Listen</p>
                <p className="text-xs text-gray-400">Start listening after word is read</p>
              </div>
            </div>
            <button 
              onClick={toggleAutoListen}
              className={`w-14 h-8 rounded-full relative transition-colors ${autoListen ? 'bg-orange-500' : 'bg-gray-200'}`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${autoListen ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          {/* Audio Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${isMuted ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </div>
              <div>
                <p className="font-bold text-gray-800">Sound Effects</p>
                <p className="text-xs text-gray-400">Toggle game sounds</p>
              </div>
            </div>
            <button 
              onClick={toggleMute}
              className={`w-14 h-8 rounded-full relative transition-colors ${isMuted ? 'bg-gray-200' : 'bg-green-500'}`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${isMuted ? 'left-1' : 'left-7'}`} />
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
                <p className="text-xs text-gray-400">Choose how the host sounds</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-50 rounded-2xl">
              <button 
                onClick={() => setVoiceQuality('natural')}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${voiceQuality === 'natural' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
              >
                Natural (AI)
              </button>
              <button 
                onClick={() => setVoiceQuality('standard')}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${voiceQuality === 'standard' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
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
                <p className="text-xs text-gray-400">How long to wait for spelling</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 p-1 bg-gray-50 rounded-2xl">
              {(['normal', 'longer', 'off'] as const).map((t) => (
                <button 
                  key={t}
                  onClick={() => setListeningTimeout(t)}
                  className={`py-2 rounded-xl text-sm font-bold capitalize transition-all ${listeningTimeout === t ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400'}`}
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
