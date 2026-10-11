import { useEffect, useRef } from 'react';

/**
 * useScreenWakeLock — keeps the device screen awake while the app is
 * actively in use. Uses the Screen Wake Lock API where available and
 * silently does nothing on browsers that don't support it.
 *
 * The lock is acquired on mount and reacquired automatically when the
 * page becomes visible again after being hidden (the wake lock is
 * always released by the browser when the tab is backgrounded).
 */
export function useScreenWakeLock() {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    const acquire = async () => {
      try {
        if (sentinelRef.current && !sentinelRef.current.released) return;
        sentinelRef.current = await navigator.wakeLock.request('screen');
        sentinelRef.current.addEventListener('release', () => {
          sentinelRef.current = null;
        });
      } catch {
        // Acquisition can fail (e.g. battery saver, iframe permissions).
        // Silently ignore — the screen simply falls back to normal sleep.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (sentinelRef.current && !sentinelRef.current.released) {
        sentinelRef.current.release();
      }
      sentinelRef.current = null;
    };
  }, []);
}