/**
 * IMPORTANT — DO NOT use this barrel for static imports in route-level code.
 *
 * App.tsx lazy-loads each page via React.lazy(() => import('./pages/XxxPage')).
 * A static import from this barrel (e.g. `import { HomePage } from './pages'`)
 * will eagerly evaluate ALL page modules, defeating the code-splitting that
 * React.lazy() provides and sending all four page bundles in the initial load.
 *
 * Use this file only for:
 *   - Unit/integration test files that need a page component synchronously
 *   - Type-only imports (`import type { ... }`)
 */
export { default as HomePage } from "./HomePage";
export { default as GamePage } from "./GamePage";
export { default as ResultsPage } from "./ResultsPage";
export { default as LeaderboardPage } from "./LeaderboardPage";
