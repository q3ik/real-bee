import { useNavigate } from "react-router-dom";
import Onboarding from "../components/Onboarding";

export default function HomePage() {
  const navigate = useNavigate();

  return <Onboarding onStart={() => navigate("/game")} />;
}
