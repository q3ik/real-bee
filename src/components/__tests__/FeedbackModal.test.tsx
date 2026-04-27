/**
 * RTL tests for FeedbackModal (SUB-14 AC items 4, 5)
 *
 * AC item 4: FeedbackModal renders without errors
 * AC item 5: FeedbackModal submits via useDiagnosticsBugReport (mock)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FeedbackModal from "../FeedbackModal";

// ---------------------------------------------------------------------------
// Mock useDiagnosticsBugReport
// ---------------------------------------------------------------------------

const mockSubmitReport = vi.fn();
const mockReset = vi.fn();

let mockIsSubmitting = false;
let mockIsSubmitted = false;
let mockSubmitError: string | null = null;

vi.mock("../../hooks/useDiagnosticsBugReport", () => ({
  useDiagnosticsBugReport: () => ({
    submitReport: mockSubmitReport,
    isSubmitting: mockIsSubmitting,
    isSubmitted: mockIsSubmitted,
    submitError: mockSubmitError,
    deliveryMethod: null,
    reset: mockReset,
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FeedbackModal", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSubmitting = false;
    mockIsSubmitted = false;
    mockSubmitError = null;
  });

  it("renders without errors when open", () => {
    render(<FeedbackModal open onClose={onClose} />);
    expect(
      screen.getByRole("dialog", { hidden: true }),
    ).toBeInTheDocument();
  });

  it("does not render when open=false", () => {
    render(<FeedbackModal open={false} onClose={onClose} />);
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
  });

  it("calls submitReport when form submitted with a title (AC item 5)", async () => {
    mockSubmitReport.mockResolvedValueOnce(undefined);
    render(<FeedbackModal open onClose={onClose} />);

    const titleInput = screen.getByPlaceholderText(/brief description/i);
    fireEvent.change(titleInput, { target: { value: "Modal bug" } });

    const sendBtn = screen.getByRole("button", { name: /send report/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(mockSubmitReport).toHaveBeenCalledTimes(1);
    });

    const [userDescription] =
      mockSubmitReport.mock.calls[0] as [string, Record<string, unknown>];
    expect(userDescription).toContain("Modal bug");
  });

  it("does not call submitReport when title is empty", () => {
    render(<FeedbackModal open onClose={onClose} />);
    const sendBtn = screen.getByRole("button", { name: /send report/i });
    fireEvent.click(sendBtn);
    expect(mockSubmitReport).not.toHaveBeenCalled();
  });

  it("shows error message when submitError is set", () => {
    mockSubmitError = "Timeout";
    render(<FeedbackModal open onClose={onClose} />);
    expect(screen.getByText(/submission failed/i)).toBeInTheDocument();
  });
});
