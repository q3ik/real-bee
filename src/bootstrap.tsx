import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { registerServiceWorker } from "./lib/serviceWorker";
import "./index.css";
import "./styles/touch-target-fixes.css";
import "./styles/mobile-modal-fixes.css";

// Render the app first so that the initial paint is not blocked by
// service worker registration or any other bootstrap side effects.
const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// Register the PWA service worker in production only (avoids HMR conflicts).
// Registration happens AFTER render to avoid blocking the initial paint.
if (import.meta.env.PROD && typeof navigator !== "undefined") {
  window.addEventListener("load", () => {
    void registerServiceWorker();
  });
}
