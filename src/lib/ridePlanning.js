import { haversine } from '@/lib/navigation';

export async function calculatePlannedRoute(waypoints = []) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) return null;
  const valid = waypoints.filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));
  if (valid.length < 2) return null;

  const coords = valid.map((p) => `${p.lng},${p.lat}`).join(';');
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&continue_straight=false`);
  if (!response.ok) throw new Error(`Routing failed (${response.status})`);
  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) throw new Error('No route found');

  const coordinates = (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]);
  const legs = (route.legs || []).map((leg, index) => ({
    index,
    distance_km: Number(leg.distance || 0) / 1000,
    duration_minutes: Number(leg.duration || 0) / 60,
    from: valid[index]?.name || `Point ${index + 1}`,
    to: valid[index + 1]?.name || `Point ${index + 2}`,
    steps: (leg.steps || []).map((step) => ({
      name: step.name,
      distance_m: step.distance,
      duration_s: step.duration,
      maneuver: step.maneuver,
    })),
  }));

  return {
    coordinates,
    legs,
    distance_km: Number(route.distance || 0) / 1000,
    duration_minutes: Number(route.duration || 0) / 60,
    waypoints: valid,
    engine: 'osrm',
    calculated_at: new Date().toISOString(),
  };
}

export function routeDistanceForLeg(routeData, index, fallbackWaypoints = []) {
  const routed = Number(routeData?.legs?.[index]?.distance_km);
  if (Number.isFinite(routed) && routed > 0) return routed;
  if (fallbackWaypoints[index] && fallbackWaypoints[index + 1]) {
    return haversine(
      fallbackWaypoints[index].lat,
      fallbackWaypoints[index].lng,
      fallbackWaypoints[index + 1].lat,
      fallbackWaypoints[index + 1].lng
    );
  }
  return 0;
}
