export function cacheEmergencyData(data) {
  try {
    localStorage.setItem('motogo_emergency_pending', JSON.stringify({ ...data, cached_at: Date.now() }));
  } catch (e) { console.error('Failed to cache emergency data:', e); }
}

export function getPendingEmergency() {
  try {
    const data = localStorage.getItem('motogo_emergency_pending');
    return data ? JSON.parse(data) : null;
  } catch (e) { return null; }
}

export function clearPendingEmergency() {
  try { localStorage.removeItem('motogo_emergency_pending'); } catch (e) {}
}