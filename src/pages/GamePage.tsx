import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import GameBoard from "../components/GameBoard";
import { useGameStore } from "../hooks/useGameStore";

export default function GamePage() {
  const navigate = useNavigate();

  const phase = useGameStore((s) => s.phase);
  const sessionCompleted = useGameStore((s) => s.sessionCompleted);

  // Prevent duplicate redirects while staying on the same idle render cycle.
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (phase !== "idle") {
      hasRedirectedRef.current = false;
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "idle" && sessionCompleted && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      navigate("/results", { replace: true });
    }
  }, [phase, sessionCompleted, navigate]);

  return <GameBoard />;
}
