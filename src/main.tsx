// Initialize Sentry synchronously BEFORE any other module is evaluated.
// ESM evaluates all static imports before running top-level code, so
// keeping this file free of static app imports ensures that any import-time
// errors or side effects are captured by Sentry. The dynamic import below
// loads the rest of the app only after Sentry is active.
import { initSentry } from "./lib/sentry";
initSentry();

void import("./bootstrap");
