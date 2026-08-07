import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Loads the rider's primary bike + fuel profile and derives a usable range (km).
 * Shared by RangeWarning and StopSuggestions so the query is cached once.
 */
export function useBikeRange() {
  const { data: bike } = useQuery({
    queryKey: ['primary-bike'],
    queryFn: async () => {
      const list = await base44.entities.Bike.filter({ is_primary: true }, '-created_date', 1);
      if (list && list.length) return list[0];
      const all = await base44.entities.Bike.list('-created_date', 1);
      return all && all.length ? all[0] : null;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ['fuel-profile', bike?.id],
    enabled: !!bike?.id,
    queryFn: async () => {
      const list = await base44.entities.FuelProfile.filter({ bike_id: bike.id }, '-last_calculated', 1);
      return list && list.length ? list[0] : null;
    },
  });

  let rangeKm = profile?.estimated_range_km;
  if (!rangeKm && bike?.tank_capacity_l && bike?.fuel_consumption_l_per_100km) {
    rangeKm = (bike.tank_capacity_l / bike.fuel_consumption_l_per_100km) * 100;
  }
  const safeRange = rangeKm ? rangeKm * 0.8 : null;

  return { bike, profile, rangeKm, safeRange };
}

/**
 * Returns recommended stop points along the route, based on per-leg distance.
 * - fuel: when a leg exceeds 60% of the bike's safe range.
 * - food/pub: when a leg is longer than 80 km (a natural break).
 */
export function suggestStopPoints(waypoints = [], safeRange = null) {
  if (!waypoints || waypoints.length < 2 || !safeRange) return [];
  const fuelThreshold = safeRange * 0.6;
  const foodThresholdKm = 80;
  const points = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const km = haversineKm(a, b);
    const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    const legLabel = `${a.name || 'Point ' + (i + 1)} → ${b.name || 'Point ' + (i + 2)}`;
    if (km > fuelThreshold) {
      points.push({
        key: `fuel-${i}`,
        legIndex: i,
        legLabel,
        type: 'fuel',
        lat: mid.lat,
        lng: mid.lng,
        reason: `Fuel stop suggested on ${legLabel} (${Math.round(km)} km leg).`,
      });
    }
    if (km > foodThresholdKm) {
      points.push({
        key: `food-${i}`,
        legIndex: i,
        legLabel,
        type: 'food',
        lat: mid.lat,
        lng: mid.lng,
        reason: `Pub / food break near the midpoint of ${legLabel} (${Math.round(km)} km leg).`,
      });
    }
  }
  return points.slice(0, 6);
}

/**
 * Fetches real fuel stations or pubs/cafés near a point via the backend function
 * (which calls OpenStreetMap Overpass server-side, avoiding browser CORS blocks).
 * Returns the closest candidates sorted by distance.
 */
export async function findNearbyStops(point, type, radiusM = 12000) {
  const { base44 } = await import('@/api/base44Client');
  const res = await base44.functions.invoke('get-nearby-stops', {
    lat: point.lat,
    lng: point.lng,
    type,
    radius: radiusM,
  });
  if (res?.error) throw new Error(res.error);
  const candidates = (res?.candidates || []).map((c) => ({
    id: c.id,
    name: c.name,
    amenity: c.amenity,
    lat: c.lat,
    lng: c.lng,
    distKm: c.dist_km,
  }));
  return candidates;
}