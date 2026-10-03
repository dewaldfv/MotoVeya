const STORAGE_KEY = 'motoveya_screen_orientation';

export const ORIENTATION_OPTIONS = ['auto', 'portrait', 'landscape'];

export function getScreenOrientationPreference() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return ORIENTATION_OPTIONS.includes(value) ? value : 'auto';
  } catch (_) {
    return 'auto';
  }
}

export function setScreenOrientationPreference(value) {
  const next = ORIENTATION_OPTIONS.includes(value) ? value : 'auto';
  try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
  return next;
}

export async function applyScreenOrientation(preference = getScreenOrientationPreference()) {
  // Native Android wrapper: use the real Activity orientation API.
  try {
    if (window.MotoVeyaNative && typeof window.MotoVeyaNative.setScreenOrientation === 'function') {
      return !!window.MotoVeyaNative.setScreenOrientation(preference);
    }
  } catch (_) {}

  // Web/PWA: Android browsers generally require fullscreen/installed-app
  // context before they will honor Screen Orientation API locks.
  try {
    const orientation = window.screen && window.screen.orientation;
    if (!orientation) return false;

    if (preference === 'auto') {
      if (document.fullscreenElement && document.exitFullscreen) {
        try { await document.exitFullscreen(); } catch (_) {}
      }
      if (typeof orientation.unlock === 'function') {
        try { orientation.unlock(); } catch (_) {}
      }
      return true;
    }

    const lockType = preference === 'landscape' ? 'landscape' : 'portrait';

    // A user tapping the Settings option is a user gesture. Use that gesture
    // to enter fullscreen when required, then lock the physical screen.
    if (!document.fullscreenElement && document.documentElement?.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      } catch (_) {
        // Installed PWAs may already be allowed to lock without fullscreen.
      }
    }

    if (typeof orientation.lock !== 'function') return !!document.fullscreenElement;
    await orientation.lock(lockType);
    return true;
  } catch (_) {
    return false;
  }
}

export function initScreenOrientation() {
  const preference = getScreenOrientationPreference();
  // Do not request fullscreen during startup. Native wrappers can apply the
  // saved preference immediately; browsers can apply a lock after user gesture.
  if (window.MotoVeyaNative && typeof window.MotoVeyaNative.setScreenOrientation === 'function') {
    applyScreenOrientation(preference);
  }
  return preference;
}
