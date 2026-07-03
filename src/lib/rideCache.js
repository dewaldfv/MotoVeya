const ACTIVE_RIDE_KEY = 'motogo_active_ride';
const PENDING_RIDES_KEY = 'motogo_pending_rides';
const BG_TRACKING_KEY = 'motogo_background_tracking';
const BG_EXPLAINER_KEY = 'motogo_bg_explainer_shown';

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