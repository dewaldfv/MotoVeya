import {
  Navigation, CornerUpLeft, CornerUpRight, ArrowUp, ArrowUpLeft, ArrowUpRight,
  RotateCw, Merge, Flag, ArrowLeft, ArrowRight
} from 'lucide-react';

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getManeuverIcon(maneuver) {
  if (!maneuver) return Navigation;
  const { type, modifier } = maneuver;
  if (type === 'depart' || type === 'arrive') return Flag;
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return RotateCw;
  if (type === 'merge') return Merge;
  switch (modifier) {
    case 'left': return CornerUpLeft;
    case 'right': return CornerUpRight;
    case 'slight left': return ArrowUpLeft;
    case 'slight right': return ArrowUpRight;
    case 'sharp left': return ArrowLeft;
    case 'sharp right': return ArrowRight;
    case 'straight': return ArrowUp;
    default: return ArrowUp;
  }
}

export function processRouteData(data) {
  const route = data.routes?.[0];
  if (!route) return null;
  const rawSteps = route.legs?.[0]?.steps || [];
  const coordinates = [];
  const steps = [];
  let idx = 0;
  for (const step of rawSteps) {
    const stepCoords = step.geometry?.coordinates || [];
    const startIdx = idx;
    for (const c of stepCoords) {
      coordinates.push([c[1], c[0]]);
      idx++;
    }
    steps.push({
      maneuver: step.maneuver,
      name: step.name,
      distance: step.distance,
      duration: step.duration,
      startIdx,
      endIdx: idx - 1,
    });
  }
  return { coordinates, steps, distance: route.distance, duration: route.duration };
}

export function getRouteProgress(routeData, userPos) {
  if (!routeData || !userPos) return null;
  const { coordinates, steps, distance, duration } = routeData;
  if (coordinates.length === 0) return null;

  let minDist = Infinity;
  let nearestIdx = 0;
  for (let i = 0; i < coordinates.length; i++) {
    const d = haversine(userPos[0], userPos[1], coordinates[i][0], coordinates[i][1]);
    if (d < minDist) { minDist = d; nearestIdx = i; }
  }

  const completedRoute = coordinates.slice(0, nearestIdx + 1);
  const remainingRoute = coordinates.slice(nearestIdx);

  let currentStepIdx = 0;
  for (let i = 0; i < steps.length; i++) {
    if (nearestIdx >= steps[i].startIdx && nearestIdx <= steps[i].endIdx) {
      currentStepIdx = i;
      break;
    }
  }

  const nextStep = steps[currentStepIdx + 1] || steps[currentStepIdx];

  let distanceToManeuver = null;
  if (nextStep?.maneuver?.location) {
    const [mlng, mlat] = nextStep.maneuver.location;
    distanceToManeuver = haversine(userPos[0], userPos[1], mlat, mlng) * 1000;
  }

  let remainingDistance = 0;
  for (let i = nearestIdx; i < coordinates.length - 1; i++) {
    remainingDistance += haversine(coordinates[i][0], coordinates[i][1], coordinates[i + 1][0], coordinates[i + 1][1]);
  }
  remainingDistance *= 1000;

  const remainingDuration = distance > 0 ? duration * (remainingDistance / distance) : 0;

  return { completedRoute, remainingRoute, currentStepIdx, nextStep, distanceToManeuver, remainingDistance, remainingDuration };
}

export function formatDistance(m) {
  if (m == null) return '—';
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatDuration(s) {
  if (s == null) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}