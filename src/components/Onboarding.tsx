import { useState, useEffect } from 'react';
import { GraduationCap, Zap, Play, Sparkles, LogIn, User as UserIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useGameStore } from '../hooks/useGameStore';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface OnboardingProps {
  onStart: () => void;
}

export default function Onboarding({ onStart }: OnboardingProps) {
  const { gradeLevel, setGradeLevel, difficulty, setDifficulty } = useGameStore();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase?.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    }) ?? { data: { subscription: { unsubscribe: () => {} } } };
    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      await supabase?.auth.signInWithOAuth({ provider: 'google' });
    } catch (error: unknown) {
      console.error("Google Sign-In failed:", error);
    }
  };

  const grades = [
    { label: 'K-2', value: 1 },
    { label: '3-5', value: 3 },
    { label: '6-8', value: 6 },
    { label: 'All', value: 0 },
  ];

  const difficulties: Array<{ label: string; value: 'easy' | 'medium' | 'hard' | 'all'; color: string }> = [
    { label: 'Easy', value: 'easy', color: 'bg-green-500' },
    { label: 'Medium', value: 'medium', color: 'bg-yellow-500' },
    { label: 'Hard', value: 'hard', color: 'bg-red-500' },
    { label: 'Mixed', value: 'all', color: 'bg-blue-500' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-orange-50 to-white">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-lg bg-white rounded-[40px] shadow-2xl p-8 md:p-12 border border-orange-100"
      >
        <div className="flex justify-end mb-4">
          {user ? (
            <div className="flex items-center gap-2 bg-orange-50 px-3 py-1 rounded-full">
              <UserIcon className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-bold text-orange-700">{user.user_metadata?.full_name || user.email || 'Speller'}</span>
            </div>
          ) : (
            <button 
              onClick={handleGoogleSignIn}
              className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-orange-500 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Sign in to sync progress
            </button>
          )}
        </div>

        <div className="text-center mb-10">
          <motion.div 
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 4 }}
            className="inline-block p-4 bg-orange-100 rounded-3xl mb-4"
          >
            <Sparkles className="w-10 h-10 text-orange-500" />
          </motion.div>
          <h1 className="text-4xl font-black text-gray-800 mb-2">Real Bee</h1>
          <p className="text-gray-500 font-medium">Master your spelling with voice!</p>
        </div>

        <div className="space-y-8">
          {/* Grade Level */}
          <div className="space-y-4">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Grade Level
            </label>
            <div className="grid grid-cols-4 gap-3">
              {grades.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGradeLevel(g.value)}
                  className={`py-4 rounded-2xl font-bold text-sm transition-all ${gradeLevel === g.value ? 'bg-orange-500 text-white shadow-lg scale-105' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-4">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Difficulty
            </label>
            <div className="grid grid-cols-2 gap-3">
              {difficulties.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDifficulty(d.value)}
                  className={`p-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all border-2 ${difficulty === d.value ? `border-orange-500 bg-orange-50 text-orange-600 shadow-sm` : 'border-transparent bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${d.color}`} />
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStart}
            className="w-full py-6 bg-orange-500 text-white rounded-[24px] font-black text-xl shadow-xl shadow-orange-200 flex items-center justify-center gap-3 transition-all hover:bg-orange-600"
          >
            <Play className="w-6 h-6 fill-current" />
            Start Playing
          </motion.button>
        </div>

        <p className="mt-8 text-center text-[10px] text-gray-300 font-bold uppercase tracking-widest">
          Designed for K-8 Students • Offline Ready
        </p>
      </motion.div>
    </div>
  );
}
