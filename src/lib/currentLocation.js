/**
 * Single shared source of the rider's own device location.
 *
 * Every map screen subscribes to this one watcher instead of running its own
 * navigator.geolocation call, so the marker is identical everywhere and the
 * device is not asked for a fix several times at once.
 *
 * The last accepted fix is cached, so a map opened before the first GPS fix
 * (or with location temporarily unavailable) can still show the rider's last
 * known position, flagged as stale by the consumer.
 */

const CACHE_KEY = 'motogo_last_known_location';

/** A fix older than this is treated as stale (no live updates arriving). */
export const STALE_AFTER_MS = 45_000;
/** A fix worse than this is treated as approximate rather than precise. */
export const ACCURACY_THRESHOLD_M = 150;

const WATCH_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 2000,
  timeout: 25000,
};

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (raw && Array.isArray(raw.position) && raw.position.length === 2) {
      const [lat, lng] = raw.position;
      if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
        return {
          position: [lat, lng],
          accuracy: raw.accuracy ?? null,
          heading: raw.heading ?? null,
          updatedAt: raw.updatedAt ?? null,
          error: null,
        };
      }
    }
  } catch {
    /* cache unavailable */
  }
  return { position: null, accuracy: null, heading: null, updatedAt: null, error: null };
}

let state = readCache();
const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function writeCache(snapshot) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      position: snapshot.position,
      accuracy: snapshot.accuracy,
      heading: snapshot.heading,
      updatedAt: snapshot.updatedAt,
    }));
  } catch {
    /* cache unavailable */
  }
}

function applyFix(coords) {
  const next = {
    position: [coords.latitude, coords.longitude],
    accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
    heading: Number.isFinite(coords.heading) && coords.heading >= 0 ? coords.heading : null,
    updatedAt: Date.now(),
    error: null,
  };
  if (!Number.isFinite(next.position[0]) || !Number.isFinite(next.position[1])) return;

  // Keep the better of two fixes that arrive almost together: a coarse
  // network fix landing just after a good GPS fix must not pull the marker.
  const previous = state;
  const recent = previous.updatedAt && next.updatedAt - previous.updatedAt < 3000;
  if (
    recent &&
    previous.accuracy != null &&
    next.accuracy != null &&
    next.accuracy > previous.accuracy * 1.5
  ) {
    return;
  }

  setState(next);
  writeCache(next);
}

function applyError(err) {
  // Keep the last known position visible; only the error state changes.
  setState({ error: err?.code === 1 ? 'denied' : 'unavailable' });
}

let watchId = null;
let refCount = 0;
let refreshTimer = null;

function requestFreshFix() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    setState({ error: 'unavailable' });
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => applyFix(pos.coords),
    (err) => applyError(err),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
  );
}

/**
 * Start (or join) the shared watcher. Returns a release function.
 */
export function startLocationWatch() {
  refCount += 1;
  if (watchId == null && typeof navigator !== 'undefined' && navigator.geolocation) {
    requestFreshFix();
    watchId = navigator.geolocation.watchPosition(
      (pos) => applyFix(pos.coords),
      (err) => applyError(err),
      WATCH_OPTIONS
    );
    // Some devices only report a coarse first fix; ask again shortly after so
    // the marker sharpens instead of sitting on a 1 km cell-tower estimate.
    refreshTimer = setTimeout(requestFreshFix, 6000);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0 && watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
      if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
    }
  };
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return state;
}

/** Force a one-off fresh fix (used by "recentre" style actions). */
export function refreshCurrentLocation() {
  requestFreshFix();
}