import { useState, useEffect } from 'react';

const ORIENTATION_KEY = 'motogo-orientation';
const listeners = new Set();
let currentOrientation = (() => {
  try { return localStorage.getItem(ORIENTATION_KEY) || 'auto'; } catch { return 'auto'; }
})();

async function applyOrientation(orientation) {
  try {
    if (!screen?.orientation) return;
    if (orientation === 'auto') {
      screen.orientation.unlock();
    } else {
      await screen.orientation.lock(orientation);
    }
  } catch (e) {
    // Lock requires fullscreen/PWA context — silently ignore in browser preview
  }
}

function setOrientation(orientation) {
  currentOrientation = orientation;
  try { localStorage.setItem(ORIENTATION_KEY, orientation); } catch {}
  applyOrientation(orientation);
  listeners.forEach((l) => l(orientation));
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Apply on module load so the saved preference takes effect at startup
applyOrientation(currentOrientation);

export function useOrientation() {
  const [orientation, setOrientationState] = useState(currentOrientation);

  useEffect(() => subscribe(setOrientationState), []);

  // Re-apply when the app returns to the foreground — OS can drop locks on background
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') applyOrientation(orientation);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [orientation]);

  return { orientation, setOrientation };
}