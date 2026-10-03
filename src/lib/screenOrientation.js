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
  applyScreenOrientation(next);
  return next;
}

export async function applyScreenOrientation(preference = getScreenOrientationPreference()) {
  // Native Android wrapper: use the real Activity orientation API.
  try {
    if (window.MotoVeyaNative && typeof window.MotoVeyaNative.setScreenOrientation === 'function') {
      return !!window.MotoVeyaNative.setScreenOrientation(preference);
    }
  } catch (_) {}

  // Web/PWA: Screen Orientation API is supported only in some contexts.
  try {
    const orientation = window.screen && window.screen.orientation;
    if (!orientation || typeof orientation.lock !== 'function') return false;
    if (preference === 'auto') {
      if (typeof orientation.unlock === 'function') orientation.unlock();
      return true;
    }
    const lockType = preference === 'landscape' ? 'landscape' : 'portrait';
    await orientation.lock(lockType);
    return true;
  } catch (_) {
    // Browsers may reject lock() outside fullscreen/installed-app contexts.
    return false;
  }
}

export function initScreenOrientation() {
  const preference = getScreenOrientationPreference();
  // Native wrapper can apply immediately; web browsers may reject until user gesture.
  applyScreenOrientation(preference);
  return preference;
}
