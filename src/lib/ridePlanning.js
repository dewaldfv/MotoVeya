import { haversine } from '@/lib/navigation';

export const ROUTE_STYLES = {
  fastest: { label: 'Fastest', description: 'Prioritise the quickest road route.' },
  balanced: { label: 'Balanced', description: 'Balance time, distance and road complexity.' },
  twisties: { label: 'Twisties', description: 'Prefer routes with more turns and road complexity.' },
};

function normaliseRoute(route, valid) {
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
  const turnCount = legs.reduce((sum, leg) => sum + leg.steps.filter((s) => {
    const t = s.maneuver?.type;
    return t === 'turn' || t === 'roundabout' || t === 'rotary' || t === 'merge';
  }).length, 0);
  const distanceKm = Number(route.distance || 0) / 1000;
  return {
    coordinates,
    legs,
    distance_km: distanceKm,
    duration_minutes: Number(route.duration || 0) / 60,
    waypoints: valid,
    engine: 'osrm',
    calculated_at: new Date().toISOString(),
    turn_count: turnCount,
    turn_density: distanceKm > 0 ? turnCount / distanceKm : 0,
  };
}

function scoreRoute(route, style, minDistance, maxDistance, minDuration, maxDuration, maxTurnDensity) {
  const distanceNorm = maxDistance > minDistance ? (route.distance_km - minDistance) / (maxDistance - minDistance) : 0;
  const durationNorm = maxDuration > minDuration ? (route.duration_minutes - minDuration) / (maxDuration - minDuration) : 0;
  const turnNorm = maxTurnDensity > 0 ? route.turn_density / maxTurnDensity : 0;
  if (style === 'fastest') return durationNorm;
  if (style === 'twisties') return (1 - Math.min(turnNorm, 1)) * 0.75 + durationNorm * 0.25;
  return durationNorm * 0.5 + distanceNorm * 0.5;
}

export async function calculatePlannedRoute(waypoints = [], style = 'fastest') {
  if (!Array.isArray(waypoints) || waypoints.length < 2) return null;
  const valid = waypoints.filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));
  if (valid.length < 2) return null;

  const coords = valid.map((p) => `${p.lng},${p.lat}`).join(';');
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&continue_straight=false&alternatives=true`);
  if (!response.ok) throw new Error(`Routing failed (${response.status})`);
  const data = await response.json();
  const routes = (data.routes || []).map((route) => normaliseRoute(route, valid));
  if (!routes.length) throw new Error('No route found');

  const minDistance = Math.min(...routes.map((r) => r.distance_km));
  const maxDistance = Math.max(...routes.map((r) => r.distance_km));
  const minDuration = Math.min(...routes.map((r) => r.duration_minutes));
  const maxDuration = Math.max(...routes.map((r) => r.duration_minutes));
  const maxTurnDensity = Math.max(...routes.map((r) => r.turn_density), 0);
  const scored = routes.map((route) => ({
    ...route,
    score: scoreRoute(route, style, minDistance, maxDistance, minDuration, maxDuration, maxTurnDensity),
  })).sort((a, b) => a.score - b.score);

  const selected = scored[0];
  return {
    ...selected,
    style,
    alternatives: scored.slice(0, 3).map((r, index) => ({
      index,
      distance_km: r.distance_km,
      duration_minutes: r.duration_minutes,
      turn_count: r.turn_count,
      turn_density: r.turn_density,
      score: r.score,
      selected: r === selected,
    })),
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