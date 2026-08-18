import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function distanceKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r;
  const dLng = (bLng - aLng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const groupRideId = body.group_ride_id;
    if (!groupRideId) return Response.json({ error: 'group_ride_id required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const ride = await svc.entities.GroupRide.get(groupRideId).catch(() => null);
    if (!ride) return Response.json({ error: 'Ride not found' }, { status: 404 });

    const participants = await svc.entities.RideParticipant.filter({ group_ride_id: groupRideId });
    if (!(participants || []).some((p) => p.user_id === me.id)) {
      return Response.json({ error: 'Not a ride participant' }, { status: 403 });
    }

    const activeParticipants = (participants || []).filter((p) => p.lat != null && p.lng != null);
    const [crashes, distress] = await Promise.all([
      svc.entities.CrashAlert.filter({ status: 'active' }, '-created_date', 100),
      svc.entities.DistressAlert.filter({ status: 'active' }, '-created_date', 100),
    ]);

    // Only expose safety locations that are reasonably near the group ride.
    const nearby = [...(crashes || []), ...(distress || [])].filter((alert) =>
      alert.lat != null && alert.lng != null &&
      activeParticipants.some((p) => distanceKm(p.lat, p.lng, alert.lat, alert.lng) <= 50)
    ).map((a) => ({
      id: a.id,
      type: a.rider_id === me.id ? 'self' : (a.reason ? 'distress' : 'crash'),
      rider_id: a.rider_id,
      rider_name: a.rider_name,
      lat: a.lat,
      lng: a.lng,
      timestamp: a.timestamp,
      status: a.status,
      severity: a.severity,
    }));

    return Response.json({ alerts: nearby });
  } catch (error) {
    console.error('get-group-safety-alerts:', error.message);
    return Response.json({ error: 'Unable to load safety alerts' }, { status: 500 });
  }
}
