/**
 * FeedbackModal — bottom-sheet variant of the bug report UI (SUB-14).
 *
 * Rendered as a fixed bottom sheet using Tailwind utility classes.
 * Prefer this component on narrow/mobile viewports; use FeedbackDialog
 * for desktop-style centred modals.
 *
 * Auto-close after successful submission is driven by a useEffect watching
 * `isSubmitted` — NOT by reading submitError after the async call, which
 * would read stale closure state.
 */
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useDiagnosticsBugReport } from '../hooks/useDiagnosticsBugReport';

interface FeedbackModalProps {
  /** Controls open state from the parent. */
  open: boolean;
  /** Called when the modal requests to close (cancel or post-submit). */
  onClose: () => void;
  /** Optional pre-fill for the description field. */
  defaultDescription?: string;
}

export default function FeedbackModal({
  open,
  onClose,
  defaultDescription = '',
}: FeedbackModalProps) {
  const { submitReport, isSubmitting, isSubmitted, submitError } =
    useDiagnosticsBugReport({ feature: 'FeedbackModal' });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(defaultDescription);

  /**
   * Auto-close after a successful submission.
   * We watch `isSubmitted` in a useEffect rather than reading `submitError`
   * synchronously after `await submitReport(...)` — the latter captures a
   * stale closure value and will always see the pre-call state.
   */
  useEffect(() => {
    if (!isSubmitted) return;
    const timer = setTimeout(onClose, 1200);
    return () => clearTimeout(timer);
  }, [isSubmitted, onClose]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const userDescription = description.trim()
      ? `${title.trim()} — ${description.trim()}`
      : title.trim();
    await submitReport(userDescription, { title: title.trim(), description: description.trim() });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-t-3xl shadow-2xl p-6 space-y-6">
        {/* Drag handle */}
        <div className="flex justify-center">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2
              id="feedback-modal-title"
              className="text-xl font-black text-gray-800"
            >
              Report a Problem
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Something not working right? Let us know and we'll fix it.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="feedback-modal-title-input"
              className="text-sm font-semibold text-gray-700"
            >
              Summary
            </label>
            <input
              id="feedback-modal-title-input"
              type="text"
              placeholder="Brief description of the issue"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting || isSubmitted}
              maxLength={120}
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-100 focus:border-orange-500 outline-none text-sm disabled:opacity-50"
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
              rows={3}
              placeholder="What were you doing when this happened?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting || isSubmitted}
              maxLength={1000}
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-100 focus:border-orange-500 outline-none text-sm resize-none disabled:opacity-50"
            />
          </div>

          {submitError && (
            <p className="text-sm text-red-600">
              Submission failed — please try again.
            </p>
          )}

          {isSubmitted && (
            <p className="text-sm text-green-600 font-semibold">
              Thanks! Your report was submitted.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 pb-safe">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-3 rounded-2xl border-2 border-gray-100 text-gray-600 font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isSubmitted || !title.trim()}
            className="flex-1 py-3 rounded-2xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Sending…' : 'Send Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
