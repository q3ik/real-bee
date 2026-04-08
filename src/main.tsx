// Initialize Sentry first — before the rest of the app module graph is
// evaluated — by keeping this file free of static app imports and using
// a dynamic import for the bootstrap. ESM evaluates all static imports
// before any top-level code in a module, so interleaving initSentry()
// with static imports does NOT guarantee early capture. The dynamic
// import below ensures initSentry() executes synchronously first.
import { initSentry } from "./lib/sentry";
initSentry();

void import("./bootstrap");
