/**
 * PageFallback — full-screen loading spinner used as the Suspense fallback
 * for lazy-loaded page routes, and as the loading state in RequireAuth while
 * auth state resolves.
 *
 * Kept in its own file so neither App.tsx nor RequireAuth.tsx need to
 * import from each other.
 */
export default function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50/50 to-white">
      <div className="w-10 h-10 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin" />
    </div>
  );
}
