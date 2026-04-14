/**
 * usePwaInstall — handles the PWA `beforeinstallprompt` event.
 *
 * Provides a typed API to:
 *  - Detect whether the app is installable
 *  - Prompt the user to install the PWA
 *  - Track installation outcome
 *
 * The `beforeinstallprompt` event is fired when the browser determines the app
 * meets the installability criteria (valid manifest, service worker, HTTPS, etc.).
 * The event must be captured and its `prompt()` method called in response to a
 * user gesture (click/tap).
 *
 * @see https://web.dev/articles/customize-installation
 *
 * @example
 * ```tsx
 * function InstallButton() {
 *   const { isInstallable, promptInstall } = usePwaInstall();
 *   if (!isInstallable) return null;
 *   return <button onClick={promptInstall}>Install App</button>;
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Extended BeforeInstallPromptEvent with the prompt() and userChoice APIs */
interface BeforeInstallPromptEvent extends Event {
  /** Call to show the native install prompt (must be called from a user gesture) */
  prompt: () => Promise<void>;
  /** Resolves with the user's choice after the prompt is dismissed */
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/** Return type for the usePwaInstall hook */
export interface UsePwaInstallResult {
  /** Whether the app meets the installability criteria */
  isInstallable: boolean;
  /** Whether the PWA is already installed */
  isInstalled: boolean;
  /** Call this from a user gesture (e.g. click handler) to show the install prompt */
  promptInstall: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if the app is running in standalone/display mode (i.e. installed) */
function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePwaInstall(): UsePwaInstallResult {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(isRunningStandalone());
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Listen for beforeinstallprompt — fires when the app is installable
    const handler = (e: Event) => {
      // Prevent the default mini-infobar on Android Chrome
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Also detect if the app is already installed
    const mq = window.matchMedia("(display-mode: standalone)");
    setIsInstalled(mq.matches);

    const onChange = (ev: MediaQueryListEvent) => setIsInstalled(ev.matches);
    mq.addEventListener("change", onChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      mq.removeEventListener("change", onChange);
    };
  }, []);

  const promptInstall = useCallback(() => {
    const deferredPrompt = deferredPromptRef.current;
    if (!deferredPrompt) return;

    // Show the native install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === "accepted") {
        console.log("[PWA] User accepted the install prompt");
        setIsInstalled(true);
      } else {
        console.log("[PWA] User dismissed the install prompt");
      }
      // Clear the deferred prompt so it can't be used again
      deferredPromptRef.current = null;
      setIsInstallable(false);
    });
  }, []);

  return { isInstallable, isInstalled, promptInstall };
}
