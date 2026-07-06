import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { group_ride_id, lat, lng, speed_kmh, battery_level, gps_status, riding_status, distance_km, max_speed_kmh } = body || {};
    if (!group_ride_id || lat == null || lng == null) return Response.json({ error: 'Missing fields' }, { status: 400 });

    const svc = base44.asServiceRole;
    const existing = await svc.entities.RideParticipant.filter({ group_ride_id, user_id: me.id });
    let participant = existing?.[0];
    let ride = null;
    try { ride = await svc.entities.GroupRide.get(group_ride_id); } catch (e) {}

    let distFromLeader = null;
    if (ride?.leader_id && ride.leader_id !== me.id) {
      const lp = (await svc.entities.RideParticipant.filter({ group_ride_id, user_id: ride.leader_id }))?.[0];
      if (lp?.lat != null) distFromLeader = haversine(lat, lng, lp.lat, lp.lng);
    } else {
      distFromLeader = 0;
    }

    const update = {
      lat, lng,
      speed_kmh: speed_kmh ?? 0,
      battery_level: battery_level ?? null,
      gps_status: gps_status || 'good',
      riding_status: riding_status || 'riding',
      distance_from_leader_km: distFromLeader,
      last_updated: new Date().toISOString(),
    };
    if (distance_km != null) update.distance_km = distance_km;
    if (max_speed_kmh != null) update.max_speed_kmh = max_speed_kmh;

    if (participant) {
      participant = await svc.entities.RideParticipant.update(participant.id, update);
    } else {
      // Access control: only members of the group, or the assigned leader/sweep, may join a ride.
      const isLeader = ride?.leader_id === me.id;
      const isSweep = ride?.sweep_id === me.id;
      let groupMember = false;
      if (ride?.group_id) {
        try {
          const gm = await svc.entities.GroupMember.filter({ group_id: ride.group_id, user_id: me.id, status: 'active' });
          groupMember = !!(gm && gm.length > 0);
        } catch (e) {}
      }
      if (!isLeader && !isSweep && !groupMember) {
        return Response.json({ access_denied: true, reason: 'You are not a member of this group ride' }, { status: 403 });
      }
      let bike = null;
      try { const bikes = await svc.entities.Bike.filter({ created_by_id: me.id, is_primary: true }, '-created_date', 1); bike = bikes[0]; } catch (e) {}
      participant = await svc.entities.RideParticipant.create({
        group_ride_id, user_id: me.id,
        user_name: me.nickname || me.full_name || 'Rider',
        avatar_url: me.avatar_url || null,
        bike_make: bike?.make || null,
        bike_model: bike?.model || null,
        role: ride?.leader_id === me.id ? 'leader' : (ride?.sweep_id === me.id ? 'sweep' : 'member'),
        joined_at: new Date().toISOString(),
        distance_km: distance_km ?? 0,
        max_speed_kmh: max_speed_kmh ?? 0,
        ...update,
      });
    }

    const all = await svc.entities.RideParticipant.filter({ group_ride_id }, '-last_updated', 100);
    return Response.json({ participant, participants: all || [] });
  } catch (error) {
    console.error('update-rider-location error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}