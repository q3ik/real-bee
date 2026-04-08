import { useState, useEffect } from 'react';

/**
 * Viewport size category
 */
export type ViewportSize = 'phone' | 'tablet' | 'desktop';

/**
 * Hook return type with viewport information
 */
export interface ViewportInfo {
  /** Current viewport size category: "phone" | "tablet" | "desktop" */
  viewport: ViewportSize;
  /** Current window width in pixels */
  width: number;
  /** Current window height in pixels */
  height: number;
  /** True if viewport is exactly phone-sized (0-767px) */
  isMobile: boolean;
  /** True if viewport is exactly tablet-sized (768-1023px) */
  isTablet: boolean;
  /** True if viewport is exactly desktop-sized (1024px+) */
  isDesktop: boolean;
}

/**
 * Determine viewport size category from pixel width.
 * Breakpoints: phone < 768, tablet < 1024, desktop >= 1024.
 */
function getViewportSize(width: number): ViewportSize {
  if (width < 768) return 'phone';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

/**
 * Custom hook for reactive viewport size detection
 *
 * Provides type-safe viewport information that updates on window resize.
 *
 * @returns ViewportInfo - Current viewport dimensions and size category
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { viewport, isMobile } = useViewport();
 *
 *   return (
 *     <div>
 *       {isMobile ? <MobileView /> : <DesktopView />}
 *       <p>Current viewport: {viewport}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useViewport(): ViewportInfo {
  // Initialize with current window dimensions (or safe defaults for SSR)
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => {
    if (typeof window !== 'undefined') {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    }
    // Default to mobile-first dimensions for SSR
    return {
      width: 375, // iPhone 12/13 width
      height: 667,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const handleResize = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 150); // 150ms debounce
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const viewport = getViewportSize(dimensions.width);

  return {
    viewport,
    width: dimensions.width,
    height: dimensions.height,
    isMobile: viewport === 'phone',
    isTablet: viewport === 'tablet',
    isDesktop: viewport === 'desktop',
  };
}

/**
 * Hook for detecting if viewport matches a specific size or larger
 *
 * @param minSize - Minimum viewport size to match
 * @returns true if current viewport is at least minSize
 *
 * @example
 * ```tsx
 * function SidebarLayout() {
 *   const showSidebar = useViewportMinSize('tablet');
 *
 *   return (
 *     <div>
 *       <MainContent />
 *       {showSidebar && <Sidebar />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useViewportMinSize(minSize: ViewportSize): boolean {
  const { viewport } = useViewport();

  const sizeOrder: Record<ViewportSize, number> = {
    phone: 0,
    tablet: 1,
    desktop: 2,
  };

  return sizeOrder[viewport] >= sizeOrder[minSize];
}

/**
 * Hook for detecting if viewport matches a specific size or smaller
 *
 * @param maxSize - Maximum viewport size to match
 * @returns true if current viewport is at most maxSize
 *
 * @example
 * ```tsx
 * function CompactControls() {
 *   const useCompactLayout = useViewportMaxSize('phone');
 *
 *   return (
 *     <div className={useCompactLayout ? 'compact' : 'full'}>
 *       Controls
 *     </div>
 *   );
 * }
 * ```
 */
export function useViewportMaxSize(maxSize: ViewportSize): boolean {
  const { viewport } = useViewport();

  const sizeOrder: Record<ViewportSize, number> = {
    phone: 0,
    tablet: 1,
    desktop: 2,
  };

  return sizeOrder[viewport] <= sizeOrder[maxSize];
}
