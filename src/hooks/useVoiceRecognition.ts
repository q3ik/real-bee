import { useState, useEffect, useCallback, useRef } from 'react';

interface VoiceRecognitionOptions {
  targetWord?: string;
  onTranscript?: (transcript: string) => void;
  onResult?: (result: string) => void;
  onError?: (error: string) => void;
  timeout?: number;
}

export function useVoiceRecognition(options: VoiceRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [timeLeft, setTimeLeft] = useState(100);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      options.onError?.("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
      setTimeLeft(100);
      
      const duration = options.timeout || 10000;
      const interval = 100;
      let elapsed = 0;
      
      timerRef.current = setInterval(() => {
        elapsed += interval;
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
        setTimeLeft(remaining);
        if (remaining <= 0) {
          stopListening();
        }
      }, interval);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const currentTranscript = finalTranscript || interimTranscript;
      setTranscript(currentTranscript);
      options.onTranscript?.(currentTranscript);

      // Pattern Extraction Logic: "Word. W-O-R-D. Word."
      // We look for a sequence of single letters or NATO words
      if (finalTranscript) {
        const processed = processSpelling(finalTranscript, options.targetWord);
        if (processed) {
          options.onResult?.(processed);
          stopListening();
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        // Silence is fine, just stop listening without a loud error
        stopListening();
        return;
      }
      
      console.error("Speech recognition error:", event.error);
      let msg = "We didn't hear anything—try again or check your mic.";
      if (event.error === 'not-allowed') msg = "Microphone access denied. Please enable it in settings.";
      options.onError?.(msg);
      stopListening();
    };

    recognition.onend = () => {
      setIsListening(false);
      if (timerRef.current) clearInterval(timerRef.current);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [options, stopListening]);

  return { isListening, transcript, timeLeft, startListening, stopListening };
}

// Helper to extract spelling from transcript
function processSpelling(transcript: string, target?: string): string | null {
  const words = transcript.toLowerCase().trim().split(/[\s-]+/);
  if (words.length === 0) return null;

  const targetLower = target?.toLowerCase();
  
  // NATO alphabet mapping
  const nato: Record<string, string> = {
    'alpha': 'a', 'bravo': 'b', 'charlie': 'c', 'delta': 'd', 'echo': 'e',
    'foxtrot': 'f', 'golf': 'g', 'hotel': 'h', 'india': 'i', 'juliet': 'j',
    'kilo': 'k', 'lima': 'l', 'mike': 'm', 'november': 'n', 'oscar': 'o',
    'papa': 'p', 'quebec': 'q', 'rome': 'r', 'sierra': 's', 'tango': 't',
    'uniform': 'u', 'victor': 'v', 'whiskey': 'w', 'xray': 'x', 'yankee': 'y', 'zulu': 'z'
  };

  // Check for "stop" or repeating the word at the end
  const lastWord = words[words.length - 1];
  const isStop = lastWord === 'stop' || (targetLower && lastWord === targetLower);
  
  // Check for wake word at the start
  const firstWord = words[0];
  const hasWakeWord = targetLower && firstWord === targetLower;

  // Extract potential spelling words
  let spellingStartIndex = hasWakeWord ? 1 : 0;
  let spellingEndIndex = isStop ? words.length - 1 : words.length;

  const spellingWords = words.slice(spellingStartIndex, spellingEndIndex);
  
  // Convert NATO words to letters and filter for single letters
  const letters = spellingWords.map(w => nato[w] || (w.length === 1 ? w : null)).filter(Boolean) as string[];

  // If we have a stop word, we MUST return something (even if empty, to trigger submission)
  if (isStop && letters.length > 0) {
    return letters.join('');
  }

  // Fallback: if we have a target, use it to bias/correct
  if (target && letters.length > 0) {
    const spelling = letters.join('');
    // If the sequence of letters matches a significant portion of the target, return it
    if (spelling.length >= target.length * 0.5) {
      return spelling;
    }
  }

  // If no stop word yet, but we have some letters and it's a final transcript, 
  // we might want to wait for the stop word or timeout.
  // The hook calls this on finalTranscript.
  
  return null;
}
