// Shared geo helpers for backend functions.

// Raw haversine distance in km (unrounded).
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Haversine rounded to 0.1 km — used by group-ride distance-from-leader.
export function haversineRounded(lat1, lng1, lat2, lng2) {
  return Math.round(haversine(lat1, lng1, lat2, lng2) * 10) / 10;
}