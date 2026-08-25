import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r;
  const dLng = (bLng - aLng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function minDistanceToRoute(lat: number, lng: number, route: number[][]) {
  if (!route?.length) return Infinity;
  // Sample the route to keep the request cheap even for long routes.
  const step = Math.max(1, Math.floor(route.length / 300));
  let min = Infinity;
  for (let i = 0; i < route.length; i += step) {
    const point = route[i];
    if (!Array.isArray(point) || point.length < 2) continue;
    min = Math.min(min, distanceKm(lat, lng, point[0], point[1]));
  }
  const last = route[route.length - 1];
  if (Array.isArray(last) && last.length >= 2) min = Math.min(min, distanceKm(lat, lng, last[0], last[1]));
  return min;
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const route = Array.isArray(body.route) ? body.route : [];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json({ error: 'lat and lng required' }, { status: 400 });
    }

    const now = new Date();
    const warnings = await base44.asServiceRole.entities.WarningAlert.filter({ status: 'active' }, '-reported_at', 200);
    const nearby = (warnings || []).filter((w: any) => {
      if (w.expires_at && new Date(w.expires_at) <= now) return false;
      if (w.lat == null || w.lng == null) return false;
      const routeDistance = route.length >= 2 ? minDistanceToRoute(w.lat, w.lng, route) : distanceKm(lat, lng, w.lat, w.lng);
      // Route corridor: warnings are visible when they are on/near the route.
      if (route.length >= 2) return routeDistance <= 1.5;
      return distanceKm(lat, lng, w.lat, w.lng) <= 5;
    }).map((w: any) => ({
      id: w.id,
      rider_id: w.rider_id,
      rider_name: w.rider_name,
      lat: w.lat,
      lng: w.lng,
      warning_type: w.warning_type,
      title: w.title,
      message: w.message || '',
      status: w.status,
      reported_at: w.reported_at,
      expires_at: w.expires_at,
      route_name: w.route_name,
      heading: w.heading,
      distance_from_rider_km: Math.round(distanceKm(lat, lng, w.lat, w.lng) * 10) / 10,
      route_distance_km: Math.round(minDistanceToRoute(w.lat, w.lng, route) * 100) / 100,
      is_self: w.rider_id === me.id,
    }));

    return Response.json({ warnings: nearby });
  } catch (error) {
    console.error('get-route-warnings:', error?.message || error);
    return Response.json({ error: 'Unable to load route warnings' }, { status: 500 });
  }
}
