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

  // Web/PWA: a portrait/landscape lock requires a fullscreen + user-gesture
  // context, which we cannot create during startup. Defer applying the saved
  // lock until the first user interaction so it persists across restarts.
  if (preference !== 'auto' && typeof window !== 'undefined') {
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