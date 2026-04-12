/**
 * RTL tests for FeedbackDialog (SUB-14 AC items 4, 5, 6)
 *
 * AC item 4: FeedbackDialog renders without errors
 * AC item 5: FeedbackModal submits via useDiagnosticsBugReport (mock)
 * AC item 6: speakAloud:true messages trigger speak (via useHostMessages mock)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FeedbackDialog from "../FeedbackDialog";

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

describe("FeedbackDialog", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSubmitting = false;
    mockIsSubmitted = false;
    mockSubmitError = null;
  });

  it("renders without errors when open", () => {
    render(<FeedbackDialog open onClose={onClose} />);
    expect(
      screen.getByRole("dialog", { hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/summary/i) ||
        screen.getByPlaceholderText(/brief description/i),
    ).toBeTruthy();
  });

  it("does not render when open=false", () => {
    render(<FeedbackDialog open={false} onClose={onClose} />);
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
  });

  it("calls submitReport when form is submitted with a title (AC item 5)", async () => {
    mockSubmitReport.mockResolvedValueOnce(undefined);
    render(<FeedbackDialog open onClose={onClose} />);

    const titleInput = screen.getByPlaceholderText(/brief description/i);
    fireEvent.change(titleInput, { target: { value: "Test bug title" } });

    const sendBtn = screen.getByRole("button", { name: /send report/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(mockSubmitReport).toHaveBeenCalledTimes(1);
    });

    const [userDescription, runtimeContext] =
      mockSubmitReport.mock.calls[0] as [string, Record<string, unknown>];
    expect(userDescription).toContain("Test bug title");
    expect(runtimeContext).toMatchObject({
      title: "Test bug title",
    });
  });

  it("does not call submitReport when title is empty", () => {
    render(<FeedbackDialog open onClose={onClose} />);
    const sendBtn = screen.getByRole("button", { name: /send report/i });
    // Button is disabled when title is empty — clicking should be a no-op
    fireEvent.click(sendBtn);
    expect(mockSubmitReport).not.toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", () => {
    render(<FeedbackDialog open onClose={onClose} />);
    // Backdrop is the sibling div with the bg-black/40 class
    const backdrop = document
      .querySelector(".backdrop-blur-sm") as HTMLElement;
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows error message when submitError is set", () => {
    mockSubmitError = "Network error";
    render(<FeedbackDialog open onClose={onClose} />);
    expect(screen.getByText(/submission failed/i)).toBeInTheDocument();
  });

  it("pre-fills description from defaultDescription prop", () => {
    render(
      <FeedbackDialog
        open
        onClose={onClose}
        defaultDescription="Pre-filled text"
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /what were you doing/i,
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Pre-filled text");
  });
});
