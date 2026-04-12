import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Switch } from "./ui/switch";
import { Slider } from "./ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import {
  DEFAULT_PREFERENCES,
  GRADE_OPTIONS,
  DIFFICULTY_OPTIONS,
  TTS_PROVIDER_OPTIONS,
} from "../constants/preferences";
import type {
  UserPreferences,
  PreferenceKey,
} from "../hooks/useUserPreferences.types";
import type { GradeLevel } from "../types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SettingsPanelProps {
  /** Whether the settings dialog is open */
  isOpen: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Current preference values */
  preferences: UserPreferences;
  /** Update a single preference by key */
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void;
  /** Reset all preferences to defaults */
  resetPreferences: () => void;
  /** Whether preferences are still loading */
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Settings panel rendered as a modal dialog using shadcn/ui primitives.
 *
 * Controls:
 * - Sound Effects (Switch)
 * - Sound Volume (Slider)
 * - TTS Provider (Select)
 * - Microphone Enabled (Switch)
 * - Grade Level (Select)
 * - Difficulty (Select)
 * - Auto Submit (Switch)
 * - Reset to Defaults (Button)
 *
 * Fully keyboard navigable and accessible.
 */
export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  preferences,
  updatePreference,
  resetPreferences,
  isLoading = false,
}) => {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const handleSoundToggle = (checked: boolean) => {
    updatePreference("soundEnabled", checked);
  };

  const handleVolumeChange = (value: number[]) => {
    updatePreference("soundVolume", value[0]);
  };

  const handleTtsProviderChange = (value: string) => {
    updatePreference("ttsProvider", value as UserPreferences["ttsProvider"]);
  };

  const handleMicToggle = (checked: boolean) => {
    updatePreference("micEnabled", checked);
  };

  const handleGradeChange = (value: string) => {
    updatePreference("grade", value as GradeLevel);
  };

  const handleDifficultyChange = (value: string) => {
    updatePreference("difficulty", value as UserPreferences["difficulty"]);
  };

  const handleAutoSubmitToggle = (checked: boolean) => {
    updatePreference("autoSubmit", checked);
  };

  const handleReset = () => {
    resetPreferences();
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading preferences…
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Audio Settings */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Audio</h3>

            {/* Sound Effects Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sound-enabled">Sound Effects</Label>
                <p className="text-xs text-muted-foreground">
                  Play sounds for game actions
                </p>
              </div>
              <Switch
                id="sound-enabled"
                checked={preferences.soundEnabled}
                onCheckedChange={handleSoundToggle}
                aria-label="Toggle sound effects"
              />
            </div>

            {/* Volume Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sound-volume">Volume</Label>
                <span className="text-xs text-muted-foreground">
                  {Math.round(preferences.soundVolume * 100)}%
                </span>
              </div>
              <Slider
                id="sound-volume"
                min={0}
                max={1}
                step={0.01}
                value={[preferences.soundVolume]}
                onValueChange={handleVolumeChange}
                disabled={!preferences.soundEnabled}
                aria-label="Sound volume"
              />
            </div>

            {/* TTS Provider Select */}
            <div className="space-y-2">
              <Label htmlFor="tts-provider">Voice Provider</Label>
              <Select
                value={preferences.ttsProvider}
                onValueChange={handleTtsProviderChange}
              >
                <SelectTrigger
                  id="tts-provider"
                  aria-label="Select voice provider"
                >
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {TTS_PROVIDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {TTS_PROVIDER_OPTIONS.find(
                  (o) => o.value === preferences.ttsProvider,
                )?.description ?? ""}
              </p>
            </div>

            {/* Microphone Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="mic-enabled">Microphone Input</Label>
                <p className="text-xs text-muted-foreground">
                  Enable voice spelling recognition
                </p>
              </div>
              <Switch
                id="mic-enabled"
                checked={preferences.micEnabled}
                onCheckedChange={handleMicToggle}
                aria-label="Toggle microphone input"
              />
            </div>
          </section>

          {/* Gameplay Settings */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Gameplay
            </h3>

            {/* Grade Level Select */}
            <div className="space-y-2">
              <Label htmlFor="grade-level">Grade Level</Label>
              <Select
                value={preferences.grade}
                onValueChange={handleGradeChange}
              >
                <SelectTrigger id="grade-level" aria-label="Select grade level">
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {GRADE_OPTIONS.map((option) => (
                    <SelectItem key={option.prefValue} value={option.prefValue}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty Select */}
            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select
                value={preferences.difficulty}
                onValueChange={handleDifficultyChange}
              >
                <SelectTrigger id="difficulty" aria-label="Select difficulty">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <SelectItem key={option.prefValue} value={option.prefValue}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auto Submit Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-submit">Auto Submit</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically submit voice input
                </p>
              </div>
              <Switch
                id="auto-submit"
                checked={preferences.autoSubmit}
                onCheckedChange={handleAutoSubmitToggle}
                aria-label="Toggle auto submit"
              />
            </div>
          </section>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsPanel;
