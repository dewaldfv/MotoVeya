import { useEffect } from 'react';

// Mirrors the unread message count onto the installed app icon.
// Uses the Badging API (installed PWA / supported desktop browsers) and the
// native Android bridge when that build exposes a badge method.
export default function useAppBadge(count) {
  useEffect(() => {
    const value = Number(count) || 0;
    try {
      if (value > 0) {
        if (navigator.setAppBadge) navigator.setAppBadge(value);
      } else if (navigator.clearAppBadge) {
        navigator.clearAppBadge();
      }
    } catch (e) {
      /* badging unsupported — ignore */
    }
    try {
      const bridge = window.MotoVeyaNative || window.AndroidMotoVeya;
      if (bridge?.setAppBadgeCount) bridge.setAppBadgeCount(value);
    } catch (e) {
      /* bridge without badge support — ignore */
    }
  }, [count]);
}