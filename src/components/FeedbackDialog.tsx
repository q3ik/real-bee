/**
 * FeedbackDialog — player-facing bug report dialog (SUB-14).
 *
 * Uses shadcn/ui Dialog primitives already present in real-bee.
 * Wires submission through useDiagnosticsBugReport.
 */
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDiagnosticsBugReport } from '../hooks/useDiagnosticsBugReport';

interface FeedbackDialogProps {
  /** Controls open state from the parent. */
  open: boolean;
  /** Called when the dialog requests to close (cancel or post-submit). */
  onClose: () => void;
  /** Optional pre-fill for the description field (e.g. last round context). */
  defaultDescription?: string;
}

/**
 * Render a modal dialog that lets the player submit a bug report.
 * Submission is delegated to `useDiagnosticsBugReport`.
 */
export default function FeedbackDialog({
  open,
  onClose,
  defaultDescription = '',
}: FeedbackDialogProps) {
  const { submitReport, isSubmitting, lastError, lastSuccess } =
    useDiagnosticsBugReport();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(defaultDescription);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await submitReport({ title: title.trim(), description: description.trim() });
    if (!lastError) {
      // Give the success state a moment to render before closing.
      setTimeout(onClose, 1200);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report a Problem</DialogTitle>
          <DialogDescription>
            Something not working right? Let us know and we'll fix it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label
              htmlFor="feedback-title"
              className="text-sm font-semibold text-gray-700"
            >
              Summary
            </label>
            <Input
              id="feedback-title"
              placeholder="Brief description of the issue"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              maxLength={120}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="feedback-description"
              className="text-sm font-semibold text-gray-700"
            >
              Details{' '}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              id="feedback-description"
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim()}
          >
            {isSubmitting ? 'Sending…' : 'Send Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
