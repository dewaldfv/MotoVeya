import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json({ error: 'Valid location required' }, { status: 400 });
    }

    const alerts = await base44.asServiceRole.entities.DistressAlert.filter(
      { status: 'active' },
      '-last_updated',
      100
    );

    const nearby = (alerts || [])
      .map((alert) => {
        const aLat = Number(alert.last_lat ?? alert.lat);
        const aLng = Number(alert.last_lng ?? alert.lng);
        if (!Number.isFinite(aLat) || !Number.isFinite(aLng)) return null;
        const distance = haversine(lat, lng, aLat, aLng);
        if (distance > 20) return null;
        return {
          id: alert.id,
          rider_id: alert.rider_id,
          rider_name: alert.rider_name || 'Rider',
          lat: aLat,
          lng: aLng,
          timestamp: alert.timestamp,
          status: alert.status,
          reason: alert.reason || 'Rider Down',
          last_updated: alert.last_updated || alert.timestamp,
          distance_from_rider_km: Math.round(distance * 10) / 10,
        };
      })
      .filter(Boolean);

    return Response.json({ alerts: nearby, radius_km: 20 });
  } catch (error) {
    console.error('get-nearby-rider-down error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
