// Sentry must be initialized before any other imports to capture early errors
import { initSentry } from "./lib/sentry";
initSentry();

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import "./styles/touch-target-fixes.css";
import "./styles/mobile-modal-fixes.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
