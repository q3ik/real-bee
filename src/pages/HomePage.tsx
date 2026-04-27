import { useNavigate } from "react-router-dom";
import Onboarding from "../components/Onboarding";
import { useGameStore } from "../hooks/useGameStore";

export default function HomePage() {
  const navigate = useNavigate();
  const { startSession } = useGameStore();

  const handleStart = async () => {
    try {
      await startSession();
      navigate("/game");
    } catch (err: unknown) {
      console.warn("[HomePage] handleStart: startSession failed", err);
    }
  };

  return <Onboarding onStart={() => { void handleStart(); }} />;
}
