/**
 * Typed service worker registration helper for Real Bee PWA.
 *
 * Provides typed registration and unregistration of the service worker,
 * with proper handling for unsupported environments (SSR, Vitest, etc.).
 */

export type SWRegistrationState = "unsupported" | "registered" | "error";

export interface SWRegistrationResult {
  state: SWRegistrationState;
  registration: ServiceWorkerRegistration | null;
  error: Error | null;
}

/**
 * Register the Real Bee service worker.
 *
 * Returns a result object indicating the registration state.
 * Returns `{ state: 'unsupported' }` when `navigator.serviceWorker` is
 * unavailable (e.g., SSR or test environments).
 *
 * @returns Promise resolving to the registration result
 */
export async function registerServiceWorker(): Promise<SWRegistrationResult> {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.serviceWorker === "undefined"
  ) {
    return { state: "unsupported", registration: null, error: null };
  }

  try {
    const registration = await navigator.serviceWorker.register(
      "/service-worker.js",
      { scope: "/" },
    );

    // Listen for update notifications
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            console.log("[PWA] Update available — new content is available.");
          }
        });
      }
    });

    console.log("[PWA] Service Worker registered:", registration.scope);
    return { state: "registered", registration, error: null };
  } catch (error) {
    console.warn("[PWA] Service Worker registration failed:", error);
    return {
      state: "error",
      registration: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Unregister the active service worker.
 *
 * @returns true if a service worker was successfully unregistered
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.serviceWorker === "undefined" ||
    typeof navigator.serviceWorker.getRegistration !== "function"
  ) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (registration) {
      const success = await registration.unregister();
      console.log("[PWA] Service Worker unregistered:", success);
      return success;
    }
  } catch (error) {
    console.warn("[PWA] Service Worker unregistration failed:", error);
  }

  return false;
}
