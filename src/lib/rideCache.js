const ACTIVE_RIDE_KEY = 'motogo_active_ride';
const PENDING_RIDES_KEY = 'motogo_pending_rides';
const BG_TRACKING_KEY = 'motogo_background_tracking';
const BG_EXPLAINER_KEY = 'motogo_bg_explainer_shown';
const MAP_CACHE_PREFIX = 'motoveya_map_cache_v1:';
const MAP_CACHE_TTL_MS = 10 * 60 * 1000;

export function saveMapDataCache(key, data, ttl = MAP_CACHE_TTL_MS) {
  try {
    localStorage.setItem(MAP_CACHE_PREFIX + key, JSON.stringify({
      savedAt: Date.now(),
      expiresAt: Date.now() + ttl,
      data,
    }));
  } catch (e) {}
}

export function getMapDataCache(key) {
  try {
    const raw = localStorage.getItem(MAP_CACHE_PREFIX + key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || cached.expiresAt <= Date.now()) {
      localStorage.removeItem(MAP_CACHE_PREFIX + key);
      return null;
    }
    return cached.data ?? null;
  } catch {
    return null;
  }
}

export function saveRideState(state) {
  try {
    localStorage.setItem(ACTIVE_RIDE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch (e) { console.error('Failed to save ride state:', e); }
}

export function getActiveRide() {
  try {
    const data = localStorage.getItem(ACTIVE_RIDE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) { return null; }
}

export function clearActiveRide() {
  try { localStorage.removeItem(ACTIVE_RIDE_KEY); } catch (e) {}
}

export function savePendingRide(rideData) {
  try {
    const pending = getPendingRides();
    pending.push({ id: `pending_${Date.now()}`, data: rideData });
    localStorage.setItem(PENDING_RIDES_KEY, JSON.stringify(pending));
  } catch (e) { console.error('Failed to save pending ride:', e); }
}

export function getPendingRides() {
  try {
    const data = localStorage.getItem(PENDING_RIDES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
}

export function clearPendingRide(id) {
  try {
    const pending = getPendingRides().filter((r) => r.id !== id);
    localStorage.setItem(PENDING_RIDES_KEY, JSON.stringify(pending));
  } catch (e) {}
}

export function isBackgroundTrackingEnabled() {
  return localStorage.getItem(BG_TRACKING_KEY) !== 'false';
}

export function setBackgroundTrackingEnabled(enabled) {
  localStorage.setItem(BG_TRACKING_KEY, enabled ? 'true' : 'false');
}

export function hasSeenBgExplainer() {
  return localStorage.getItem(BG_EXPLAINER_KEY) === 'true';
}

export function setBgExplainerSeen() {
  localStorage.setItem(BG_EXPLAINER_KEY, 'true');
}

const PENDING_NAV_KEY = 'motogo_pending_navigation';

export function savePendingNavigation(nav) {
  try { localStorage.setItem(PENDING_NAV_KEY, JSON.stringify(nav)); } catch (e) {}
}

export function getPendingNavigation() {
  try {
    const data = localStorage.getItem(PENDING_NAV_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) { return null; }
}

export function clearPendingNavigation() {
  try { localStorage.removeItem(PENDING_NAV_KEY); } catch (e) {}
}