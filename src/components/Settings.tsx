import { useGameStore } from "../hooks/useGameStore";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { useScrollLock } from "../hooks/useScrollLock";
import { SettingsPanel } from "./SettingsPanel";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Settings({ isOpen, onClose }: SettingsProps) {
  // Lock body scroll when modal is open
  useScrollLock(isOpen);

  const { userId } = useGameStore();

  // useUserPreferences for Dexie persistence and downstream sync
  const { preferences, updatePreference, resetPreferences, isLoading } =
    useUserPreferences({ userId });

  if (!isOpen) return null;

  return (
    <SettingsPanel
      isOpen={isOpen}
      onClose={onClose}
      preferences={preferences}
      updatePreference={updatePreference}
      resetPreferences={resetPreferences}
      isLoading={isLoading}
    />
  );
}
