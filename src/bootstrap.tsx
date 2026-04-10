import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import "./styles/touch-target-fixes.css";
import "./styles/mobile-modal-fixes.css";

// ---------------------------------------------------------------------------

// TODO: Resovle merge conflict! <<<<<<< zed-branch-2
// PWA Service Worker Registration
// ---------------------------------------------------------------------------
if ("serviceWorker" in navigator) {
  
// TODO: Resovle merge conflict! =======
// PWA Service Worker Registration (production only — avoids HMR conflicts)
// ---------------------------------------------------------------------------
if ("serviceWorker" in navigator && import.meta.env.PROD) {
// TODO: Resovle merge conflict! >>>>>>> trunk

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .then((registration) => {
        console.log("[PWA] Service Worker registered:", registration.scope);
      })
      .catch((error) => {
        console.warn("[PWA] Service Worker registration failed:", error);
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
    <Toaster position="top-center" richColors closeButton />
  </StrictMode>,
);
