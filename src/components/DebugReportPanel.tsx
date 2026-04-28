/**
 * DebugReportPanel — Ctrl+Shift+D bug-report overlay.
 *
 * Extracted from GamePage.tsx to keep page components focused on routing
 * logic and to make this panel independently testable/reusable.
 *
 * Usage:
 *   <DebugReportPanel
 *     isOpen={isDebugOpen}
 *     description={debugDescription}
 *     onDescriptionChange={setDebugDescription}
 *     onSubmit={handleDebugSubmit}
 *     onClose={handleDebugClose}
 *     isSubmitting={isSubmitting}
 *     isSubmitted={isSubmitted}
 *     error={submitError}
 *   />
 */
export interface DebugReportPanelProps {
  isOpen: boolean;
  description: string;
  onDescriptionChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  isSubmitting: boolean;
  isSubmitted: boolean;
  error: string | null;
}

export default function DebugReportPanel({
  isOpen,
  description,
  onDescriptionChange,
  onSubmit,
  onClose,
  isSubmitting,
  isSubmitted,
  error,
}: DebugReportPanelProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Debug bug report panel"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md mx-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-gray-800">🐛 Debug Report</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close debug panel"
          >
            ✕
          </button>
        </div>

        {isSubmitted ? (
          <div className="text-center space-y-3 py-4">
            <p className="text-green-600 font-bold text-lg">✅ Report sent!</p>
            <p className="text-gray-500 text-sm">
              Diagnostics have been captured and forwarded.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-800 text-white rounded-2xl font-bold"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm">
              Describe what went wrong (optional). A snapshot of the current
              session — score, streak, phase, difficulty — will be included with
              the report.
            </p>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="What were you doing when the issue occurred?"
              rows={3}
              className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm resize-none focus:border-orange-400 outline-none"
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={onSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 disabled:opacity-50 transition-all"
              >
                {isSubmitting ? "Sending\u2026" : "Send Report"}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
