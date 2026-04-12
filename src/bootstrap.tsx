import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { registerServiceWorker } from "./lib/serviceWorker";
import "./index.css";
import "./styles/touch-target-fixes.css";
import "./styles/mobile-modal-fixes.css";

// Render the app immediately so that the initial paint is not blocked.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// Register the PWA service worker in production only (avoids HMR conflicts).
// Registration is deferred until after the window "load" event so it does
// not block the initial paint.
if (import.meta.env.PROD) {
  window.addEventListener("load", () => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      void import("./lib/serviceWorker").then(({ registerServiceWorker }) => {
        void registerServiceWorker();
      });
    }
  });
}
