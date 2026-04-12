import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPanel } from "../SettingsPanel";
import { DEFAULT_PREFERENCES } from "../../constants/preferences";
import type { UserPreferences } from "../../hooks/useUserPreferences.types";

// ---------------------------------------------------------------------------
// Mocks for shadcn/ui components - simplified to avoid JSX in mock factories
// ---------------------------------------------------------------------------

vi.mock("../ui/dialog", () => {
  const Dialog = ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) =>
    open
      ? React.createElement("div", { "data-testid": "dialog-root" }, children)
      : null;
  const DialogContent = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "dialog-content", className },
      children,
    );
  const DialogHeader = ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "dialog-header" }, children);
  const DialogTitle = ({ children }: { children: React.ReactNode }) =>
    React.createElement("h2", { "data-testid": "dialog-title" }, children);
  const DialogFooter = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "dialog-footer", className },
      children,
    );
  return { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter };
});

vi.mock("../ui/switch", () => {
  const Switch = React.forwardRef(
    (
      {
        checked,
        onCheckedChange,
        id,
        "aria-label": ariaLabel,
        disabled,
        className,
      }: {
        checked: boolean;
        onCheckedChange: (checked: boolean) => void;
        id?: string;
        "aria-label"?: string;
        disabled?: boolean;
        className?: string;
      },
      ref: React.ForwardedRef<HTMLButtonElement>,
    ) =>
      React.createElement("button", {
        ref,
        id,
        role: "switch",
        "aria-checked": checked,
        "aria-label": ariaLabel,
        "data-state": checked ? "checked" : "unchecked",
        disabled,
        onClick: () => onCheckedChange(!checked),
        className,
      }),
  );
  return { Switch };
});

vi.mock("../ui/slider", () => {
  const Slider = ({
    value,
    onValueChange,
    id,
    "aria-label": ariaLabel,
    disabled,
    min,
    max,
    step,
    className,
  }: {
    value: number[];
    onValueChange: (value: number[]) => void;
    id?: string;
    "aria-label"?: string;
    disabled?: boolean;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
  }) =>
    React.createElement("div", {
      id,
      role: "slider",
      "aria-label": ariaLabel,
      "aria-valuemin": min ?? 0,
      "aria-valuemax": max ?? 1,
      "aria-valuenow": value[0],
      "data-disabled": disabled ?? false,
      onClick: () => onValueChange([0.5]),
      className,
      tabIndex: 0,
    });
  return { Slider };
});

vi.mock("../ui/select", () => {
  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) =>
    React.createElement(
      "div",
      { "data-value": value, "data-testid": "select-root" },
      children,
    );
  const SelectTrigger = React.forwardRef(
    (
      {
        children,
        id,
        "aria-label": ariaLabel,
        className,
      }: {
        children: React.ReactNode;
        id?: string;
        "aria-label"?: string;
        className?: string;
      },
      ref: React.ForwardedRef<HTMLButtonElement>,
    ) =>
      React.createElement(
        "button",
        {
          ref,
          id,
          "aria-label": ariaLabel,
          className,
          "data-testid": "select-trigger",
        },
        children,
      ),
  );
  const SelectContent = ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children);
  const SelectItem = ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => React.createElement("div", { "data-value": value }, children);
  const SelectValue = ({ placeholder }: { placeholder?: string }) =>
    React.createElement("span", null, placeholder);
  return { Select, SelectTrigger, SelectContent, SelectItem, SelectValue };
});

vi.mock("../ui/button", () => {
  const Button = React.forwardRef(
    (
      {
        children,
        variant,
        onClick,
        type,
        disabled,
        className,
      }: {
        children: React.ReactNode;
        variant?: string;
        onClick?: () => void;
        type?: "button" | "submit" | "reset";
        disabled?: boolean;
        className?: string;
      },
      ref: React.ForwardedRef<HTMLButtonElement>,
    ) =>
      React.createElement(
        "button",
        {
          ref,
          type,
          onClick,
          disabled,
          className,
          "data-variant": variant,
        },
        children,
      ),
  );
  return { Button };
});

vi.mock("../ui/label", () => {
  const Label = ({
    children,
    htmlFor,
    className,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }) => React.createElement("label", { htmlFor, className }, children);
  return { Label };
});

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const mockPreferences: UserPreferences = {
  ...DEFAULT_PREFERENCES,
};

const mockUpdatePreference = vi.fn();
const mockResetPreferences = vi.fn();
const mockOnClose = vi.fn();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderSettings = (props = {}) => {
    return render(
      <SettingsPanel
        isOpen={true}
        onClose={mockOnClose}
        preferences={mockPreferences}
        updatePreference={mockUpdatePreference}
        resetPreferences={mockResetPreferences}
        isLoading={false}
        {...props}
      />,
    );
  };

  it("renders nothing when isOpen is false", () => {
    render(
      <SettingsPanel
        isOpen={false}
        onClose={mockOnClose}
        preferences={mockPreferences}
        updatePreference={mockUpdatePreference}
        resetPreferences={mockResetPreferences}
      />,
    );

    expect(screen.queryByTestId("dialog-root")).not.toBeInTheDocument();
  });

  it("renders dialog when isOpen is true", () => {
    renderSettings();

    expect(screen.getByTestId("dialog-root")).toBeInTheDocument();
  });

  it("shows loading state when isLoading is true", () => {
    render(
      <SettingsPanel
        isOpen={true}
        onClose={mockOnClose}
        preferences={mockPreferences}
        updatePreference={mockUpdatePreference}
        resetPreferences={mockResetPreferences}
        isLoading={true}
      />,
    );

    expect(screen.getByText(/loading preferences/i)).toBeInTheDocument();
  });

  it("renders sound effects toggle with correct checked state", () => {
    renderSettings();

    const soundToggle = screen.getByRole("switch", {
      name: /toggle sound effects/i,
    });
    expect(soundToggle).toHaveAttribute("aria-checked", "true");
  });

  it("renders microphone toggle with correct checked state", () => {
    renderSettings();

    const micToggle = screen.getByRole("switch", {
      name: /toggle microphone input/i,
    });
    expect(micToggle).toHaveAttribute("aria-checked", "true");
  });

  it("renders auto submit toggle with correct checked state", () => {
    renderSettings();

    const autoSubmitToggle = screen.getByRole("switch", {
      name: /toggle auto submit/i,
    });
    expect(autoSubmitToggle).toHaveAttribute("aria-checked", "false");
  });

  it("renders volume slider with correct value", () => {
    renderSettings();

    const volumeSlider = screen.getByRole("slider", { name: /sound volume/i });
    expect(volumeSlider).toHaveAttribute(
      "aria-valuenow",
      String(mockPreferences.soundVolume),
    );
  });

  it("renders TTS provider select", () => {
    renderSettings();

    const selectRoots = screen.getAllByTestId("select-root");
    // First select should be TTS provider
    expect(selectRoots[0]).toHaveAttribute(
      "data-value",
      mockPreferences.ttsProvider,
    );
  });

  it("calls updatePreference when sound toggle is clicked", async () => {
    const user = userEvent.setup();
    renderSettings();

    const soundToggle = screen.getByRole("switch", {
      name: /toggle sound effects/i,
    });
    await user.click(soundToggle);

    expect(mockUpdatePreference).toHaveBeenCalledWith("soundEnabled", false);
  });

  it("calls updatePreference when mic toggle is clicked", async () => {
    const user = userEvent.setup();
    renderSettings();

    const micToggle = screen.getByRole("switch", {
      name: /toggle microphone input/i,
    });
    await user.click(micToggle);

    expect(mockUpdatePreference).toHaveBeenCalledWith("micEnabled", false);
  });

  it("calls updatePreference when auto submit toggle is clicked", async () => {
    const user = userEvent.setup();
    renderSettings();

    const autoSubmitToggle = screen.getByRole("switch", {
      name: /toggle auto submit/i,
    });
    await user.click(autoSubmitToggle);

    expect(mockUpdatePreference).toHaveBeenCalledWith("autoSubmit", true);
  });

  it("calls updatePreference when volume slider changes", async () => {
    const user = userEvent.setup();
    renderSettings();

    const volumeSlider = screen.getByRole("slider", { name: /sound volume/i });
    await user.click(volumeSlider);

    expect(mockUpdatePreference).toHaveBeenCalledWith("soundVolume", 0.5);
  });

  it("calls resetPreferences when reset button is clicked", async () => {
    const user = userEvent.setup();
    renderSettings();

    const resetButton = screen.getByRole("button", {
      name: /reset to defaults/i,
    });
    await user.click(resetButton);

    expect(mockResetPreferences).toHaveBeenCalled();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    renderSettings();

    const closeButton = screen.getByRole("button", { name: /^close$/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("disables volume slider when sound is disabled", () => {
    renderSettings({
      preferences: { ...mockPreferences, soundEnabled: false },
    });

    const volumeSlider = screen.getByRole("slider", { name: /sound volume/i });
    expect(volumeSlider).toHaveAttribute("data-disabled", "true");
  });

  it("is keyboard navigable — all controls are focusable", () => {
    renderSettings();

    const switches = screen.getAllByRole("switch");
    const buttons = screen.getAllByRole("button");

    // All switches should be buttons (accessible)
    switches.forEach((s) => {
      expect(s.tagName.toLowerCase()).toBe("button");
    });

    // All buttons should be focusable (not disabled)
    buttons.forEach((b) => {
      expect(b).not.toBeDisabled();
    });
  });
});
