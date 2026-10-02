import { useEffect } from 'react';
import { closeTopOverlay } from '@/lib/overlayManager';

/**
 * Mount once inside the Router (e.g. AppLayout). When the hardware or
 * browser Back button fires `popstate`, close the topmost open overlay
 * (BottomSheet / Dialog) instead of navigating away from the current page.
 */
export function useOverlayBackHandler() {
  useEffect(() => {
    const onPopState = () => {
      closeTopOverlay();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
}