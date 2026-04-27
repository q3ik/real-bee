/**
 * PwaInstallPrompt — dismissible banner prompting the user to install the PWA.
 *
 * Renders a compact, animated install banner when the browser fires
 * `beforeinstallprompt`. Uses the `usePwaInstall` hook to trigger the
 * native install dialog.
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, X } from "lucide-react";
import { usePwaInstall } from "../hooks/usePwaInstall";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export default function PwaInstallPrompt() {
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);

  const handleInstall = useCallback(() => {
    promptInstall();
  }, [promptInstall]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Don't render if not installable, already installed, or user dismissed
  if (!isInstallable || isInstalled || dismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "fixed top-4 left-1/2 z-50 max-w-sm w-[calc(100%-2rem)] -translate-x-1/2",
          "bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-orange-200",
          "p-4 flex items-center gap-3",
        )}
        role="alert"
        aria-label="Install Real Bee as an app"
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
          <Download className="w-5 h-5 text-orange-600" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Install Real Bee
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            Add to your home screen for quick access and offline use.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="default"
            className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 py-1.5 h-auto"
            onClick={handleInstall}
          >
            Install
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Dismiss install prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
