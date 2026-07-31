import { useState, useCallback, useEffect } from 'react';

/**
 * Tracks permission to use device orientation sensors.
 *
 * iOS 13+ requires an explicit user-gesture call to
 * `DeviceOrientationEvent.requestPermission()` before orientation events fire,
 * so we expose `request()` to call from a button click. Other platforms grant
 * orientation access by default, so we treat them as already granted.
 *
 * The decision is remembered in localStorage so we only prompt once.
 */
const STORAGE_KEY = 'motogo_orientation_permission';

function readStored() {
  try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
}

function writeStored(v) {
  try { localStorage.setItem(STORAGE_KEY, v); } catch (e) {}
}

function detectInitial() {
  // Non-iOS browsers grant orientation access without a prompt.
  const isIOS = typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function';
  if (!isIOS) return 'granted';
  const stored = readStored();
  if (stored === 'granted' || stored === 'denied') return stored;
  return 'pending';
}

export function useOrientationPermission() {
  const [state, setState] = useState(detectInitial);

  const request = useCallback(async () => {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        const next = res === 'granted' ? 'granted' : 'denied';
        writeStored(next);
        setState(next);
        return next;
      }
      writeStored('granted');
      setState('granted');
      return 'granted';
    } catch (e) {
      writeStored('denied');
      setState('denied');
      return 'denied';
    }
  }, []);

  const dismiss = useCallback(() => {
    writeStored('denied');
    setState('denied');
  }, []);

  // Re-check if the user later grants via browser settings (rare, but cheap).
  useEffect(() => {
    if (state !== 'denied') return;
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        const fresh = detectInitial();
        if (fresh === 'granted') setState('granted');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [state]);

  return { state, request, dismiss };
}