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

  // Web/PWA: screen.orientation.lock() requires a fullscreen/installed-app
  // context on mobile browsers. Auto-Rotate must NOT enter fullscreen —
  // entering fullscreen on some mobile browsers locks the orientation to the
  // current device orientation, which would defeat the purpose of Auto-Rotate.
  try {
    const orientation = window.screen && window.screen.orientation;
    if (!orientation) return false;

    if (preference === 'auto') {
      // Release any previously applied orientation lock so the sensor
      // controls rotation freely. Do NOT exit fullscreen here — exiting
      // can cause the browser to snap to a default orientation.
      if (typeof orientation.unlock === 'function') {
        try { await orientation.unlock(); } catch (_) {}
      }
      return true;
    }

    const lockType = preference === 'landscape' ? 'landscape' : 'portrait';

    // The Screen Orientation API requires a fullscreen/installed-app context
    // on many mobile browsers. Settings is a user gesture, so this is the
    // correct point to request fullscreen before applying the hard lock.
    if (!document.fullscreenElement && document.documentElement?.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      } catch (_) {
        // Installed PWAs/native wrappers may already have fullscreen context.
      }
    }

    if (typeof orientation.lock !== 'function') return false;

    try {
      await orientation.lock(lockType);
      return true;
    } catch (_) {
      // Some browsers expose the API but reject a lock outside their
      // supported fullscreen/mobile context.
      return false;
    }
  } catch (_) {
    return false;
  }
}

export function initScreenOrientation() {
  const preference = getScreenOrientationPreference();

  // Native Android wrapper: apply the saved preference immediately via the bridge.
  if (window.MotoVeyaNative && typeof window.MotoVeyaNative.setScreenOrientation === 'function') {
    applyScreenOrientation(preference);
    return preference;
  }

  // Web/PWA: browsers block orientation locks until the user interacts with
  // the page. Register a one-time first-gesture listener that applies the
  // saved orientation lock — but ONLY for portrait/landscape. For Auto-
  // Rotate, no listener is needed: the sensor controls orientation freely
  // and entering fullscreen (which can lock to the current orientation on
  // some mobile browsers) must be avoided.
  if (typeof window !== 'undefined' && preference !== 'auto') {
    let applied = false;
    const applyOnce = () => {
      if (applied) return;
      applied = true;
      applyScreenOrientation(preference);
      ['touchstart', 'click', 'keydown'].forEach((evt) =>
        window.removeEventListener(evt, applyOnce)
      );
    };
    ['touchstart', 'click', 'keydown'].forEach((evt) =>
      window.addEventListener(evt, applyOnce, { once: true, passive: true })
    );
  }

  return preference;
}