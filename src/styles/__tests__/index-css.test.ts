import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * CSS animation assertions for SUB-16.
 *
 * We verify that the CSS file loads without errors and contains
 * the expected animation declarations by reading the source file directly.
 * Reading the actual file (instead of embedding a hardcoded string copy)
 * prevents the test from drifting out of sync when CSS is updated.
 */

// Import the CSS to verify it compiles (vite plugin processes it)
import "../../index.css";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the actual CSS source — single source of truth, never drifts
const cssContent = readFileSync(resolve(__dirname, "../../index.css"), "utf-8");

describe("CSS animations (SUB-16)", () => {
  describe("CSS compiles", () => {
    it("loads index.css without errors", () => {
      // If we reach here, the CSS import succeeded and vite processed it.
      expect(true).toBe(true);
    });
  });

  describe("CSS contains expected content", () => {
    it("includes game color tokens", () => {
      expect(cssContent).toContain("--color-game-correct");
      expect(cssContent).toContain("--color-game-incorrect");
      expect(cssContent).toContain("--color-game-primary");
    });

    it("includes component classes", () => {
      expect(cssContent).toContain(".btn-primary");
      expect(cssContent).toContain(".modal-backdrop");
      expect(cssContent).toContain(".game-card");
      expect(cssContent).toContain(".input-pill");
      expect(cssContent).toContain(".letter-tile");
    });

    it("includes @keyframes animation names", () => {
      expect(cssContent).toMatch(/@keyframes\s+modalSlideIn/);
      expect(cssContent).toMatch(/@keyframes\s+cardReveal/);
      expect(cssContent).toMatch(/@keyframes\s+tilePop/);
    });

    it("respects prefers-reduced-motion", () => {
      expect(cssContent).toContain("prefers-reduced-motion: reduce");
      expect(cssContent).toContain("animation-duration: 0.01ms");
    });

    it("includes overscroll containment", () => {
      expect(cssContent).toContain("overscroll-behavior-y: contain");
    });
  });
});
