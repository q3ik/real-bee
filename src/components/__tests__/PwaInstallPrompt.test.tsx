/**
 * Tests for src/components/PwaInstallPrompt.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PwaInstallPrompt from "../PwaInstallPrompt";
import type { UsePwaInstallResult } from "../../hooks/usePwaInstall";

// ---------------------------------------------------------------------------
// Mock the usePwaInstall hook
// ---------------------------------------------------------------------------

vi.mock("../../hooks/usePwaInstall", () => ({
  usePwaInstall: vi.fn(),
}));

const mockUsePwaInstall = vi.mocked(
  await import("../../hooks/usePwaInstall"),
).usePwaInstall;

function mockPwaInstallState(
  opts: Pick<UsePwaInstallResult, "isInstallable" | "isInstalled"> & {
    promptInstall?: () => void;
  },
) {
  mockUsePwaInstall.mockReturnValue({
    isInstallable: opts.isInstallable,
    isInstalled: opts.isInstalled,
    promptInstall: opts.promptInstall ?? vi.fn(),
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("PwaInstallPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when installable and not installed", () => {
    mockPwaInstallState({ isInstallable: true, isInstalled: false });

    render(<PwaInstallPrompt />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Install Real Bee")).toBeInTheDocument();
  });

  it("does not render when not installable", () => {
    mockPwaInstallState({ isInstallable: false, isInstalled: false });

    const { container } = render(<PwaInstallPrompt />);

    expect(container.firstChild).toBeNull();
  });

  it("does not render when already installed", () => {
    mockPwaInstallState({ isInstallable: true, isInstalled: true });

    const { container } = render(<PwaInstallPrompt />);

    expect(container.firstChild).toBeNull();
  });

  it("dismiss button hides the banner", () => {
    mockPwaInstallState({ isInstallable: true, isInstalled: false });

    render(<PwaInstallPrompt />);

    expect(screen.getByRole("alert")).toBeInTheDocument();

    const dismissButton = screen.getByRole("button", { name: /dismiss/i });
    fireEvent.click(dismissButton);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("install button calls promptInstall", () => {
    const promptInstall = vi.fn();
    mockPwaInstallState({
      isInstallable: true,
      isInstalled: false,
      promptInstall,
    });

    render(<PwaInstallPrompt />);

    // There are two buttons (Install + dismiss X), find the Install one
    const buttons = screen.getAllByRole("button");
    const installButton = buttons.find((btn) => btn.textContent === "Install")!;
    fireEvent.click(installButton);

    expect(promptInstall).toHaveBeenCalledTimes(1);
  });
});
