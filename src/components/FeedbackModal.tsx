/**
 * FeedbackModal — bottom-sheet variant of the bug report UI (SUB-14).
 *
 * Uses shadcn/ui Sheet primitives already present in real-bee.
 * Wires submission through useDiagnosticsBugReport.
 * Prefer this component on narrow/mobile viewports; use FeedbackDialog
 * for desktop-style centered modals.
 */
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDiagnosticsBugReport } from '../hooks/useDiagnosticsBugReport';

interface FeedbackModalProps {
  /** Controls open state from the parent. */
  open: boolean;
  /** Called when the modal requests to close (cancel or post-submit). */
  onClose: () => void;
  /** Optional pre-fill for the description field. */
  defaultDescription?: string;
}

/**
 * Render a bottom-sheet modal that lets the player submit a bug report.
 * Submission is delegated to `useDiagnosticsBugReport`.
 */
export default function FeedbackModal({
  open,
  onClose,
  defaultDescription = '',
}: FeedbackModalProps) {
  const { submitReport, isSubmitting, lastError, lastSuccess } =
    useDiagnosticsBugReport();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(defaultDescription);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await submitReport({ title: title.trim(), description: description.trim() });
    if (!lastError) {
      setTimeout(onClose, 1200);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose();
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
        <SheetHeader className="text-left">
          <SheetTitle>Report a Problem</SheetTitle>
          <SheetDescription>
            Something not working right? Let us know and we'll fix it.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1">
            <label
              htmlFor="feedback-modal-title"
              className="text-sm font-semibold text-gray-700"
            >
              Summary
            </label>
            <Input
              id="feedback-modal-title"
              placeholder="Brief description of the issue"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              maxLength={120}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="feedback-modal-description"
              className="text-sm font-semibold text-gray-700"
            >
              Details{' '}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              id="feedback-modal-description"
              rows={4}
              placeholder="What were you doing when this happened?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              maxLength={1000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none disabled:opacity-50"
            />
          </div>

          {lastError && (
            <p className="text-sm text-red-600">
              Submission failed — please try again.
            </p>
          )}

          {lastSuccess && (
            <p className="text-sm text-green-600 font-semibold">
              Thanks! Your report was submitted.
            </p>
          )}
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim()}
          >
            {isSubmitting ? 'Sending…' : 'Send Report'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
