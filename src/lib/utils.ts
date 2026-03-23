import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getBrowserName(): string {
  if (typeof navigator === 'undefined') {
    return 'your browser';
  }
  const ua = navigator.userAgent;
  if (ua.includes('EdgiOS/')) return 'Edge';
  if (ua.includes('CriOS/')) return 'Chrome';
  if (ua.includes('FxiOS/')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome') && !ua.includes('Edg/')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (
    ua.includes('Safari') &&
    !ua.includes('Chrome') &&
    !ua.includes('CriOS') &&
    !ua.includes('FxiOS') &&
    !ua.includes('EdgiOS')
  ) {
    return 'Safari';
  }
  return 'your browser';
}
