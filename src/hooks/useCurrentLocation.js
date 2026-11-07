import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  ACCURACY_THRESHOLD_M,
  STALE_AFTER_MS,
  getSnapshot,
  refreshCurrentLocation,
  startLocationWatch,
  subscribe,
} from '@/lib/currentLocation';

function formatAge(ageMs) {
  if (ageMs == null) return 'Last known';
  if (ageMs < 60_000) return 'Last known · <1 min ago';
  const minutes = Math.round(ageMs / 60_000);
  if (minutes < 60) return `Last known · ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Last known · ${hours} hr ago`;
  return 'Last known · over a day ago';
}

/**
 * The rider's own location, shared by every map screen.
 * Returns the freshest accepted fix plus whether it can still be trusted.
 */
export default function useCurrentLocation({ enabled = true } = {}) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [, retick] = useState(0);

  // Join the shared watcher while any map is mounted. Disabled where another
  // live source (an active ride session) is already tracking the device.
  useEffect(() => {
    if (!enabled) return undefined;
    return startLocationWatch();
  }, [enabled]);

  // Age the fix so "stale" flips on screen without waiting for a new GPS event.
  useEffect(() => {
    const timer = setInterval(() => retick((n) => n + 1), 10_000);
    return () => clearInterval(timer);
  }, []);

  const ageMs = snapshot.updatedAt ? Date.now() - snapshot.updatedAt : null;
  const tooOld = ageMs == null || ageMs > STALE_AFTER_MS;
  const approximate = snapshot.accuracy != null && snapshot.accuracy > ACCURACY_THRESHOLD_M;
  const stale = !snapshot.position || tooOld || approximate;

  let statusLabel = 'Current location';
  if (snapshot.position) {
    if (approximate) statusLabel = `Approximate · ±${Math.round(snapshot.accuracy)} m`;
    else if (tooOld) statusLabel = formatAge(ageMs);
  }

  return {
    ...snapshot,
    ageMs,
    stale,
    approximate,
    statusLabel,
    refresh: refreshCurrentLocation,
  };
}