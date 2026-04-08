import { useEffect } from 'react';

/**
 * Module-level reference counter that tracks the number of currently open
 * modals that have requested a scroll lock.  Only the first opener applies
 * the lock (and captures the scroll position); only the last closer removes
 * it (and restores the scroll position).  This prevents multiple modals from
 * fighting over `body.modal-open` / `--modal-open-scroll-y`.
 */
let lockCount = 0;

/**
 * Acquires or releases the body scroll lock for iOS-safe modal overlays.
 *
 * @param isLocked - When `true` the scroll lock is acquired; releasing happens
 *   automatically in the effect cleanup, or when `isLocked` becomes `false`.
 */
export function useScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;

    if (lockCount === 0) {
      const scrollY = Math.max(0, window.scrollY);
      document.documentElement.style.setProperty('--modal-open-scroll-y', `-${scrollY}px`);
      document.body.classList.add('modal-open');
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        const rawTop = document.documentElement.style.getPropertyValue('--modal-open-scroll-y');
        document.body.classList.remove('modal-open');
        document.documentElement.style.removeProperty('--modal-open-scroll-y');
        if (rawTop) {
          window.scrollTo(0, -parseInt(rawTop, 10));
        }
      }
    };
  }, [isLocked]);
}
