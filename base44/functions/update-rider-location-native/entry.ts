// Token-authenticated group-ride route progress for the native background service.
// Mirrors update-rider-location but authenticates via device_token so the rider's
// live marker / ETA / remaining distance keep updating when the app is backgrounded
// or the screen is locked. The native layer cannot hold a live user session token.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { haversineRounded as haversine } from '../../shared/geo.ts';
import { runGeofenceCheck } from '../../shared/savedPlaceGeofence.ts';

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = String(body.device_token || '');
    if (token.length < 32) {
      return Response.json({ error: 'Invalid device token' }, { status: 400 });
    }

    const hash = await sha256(token);
    const devices = await base44.asServiceRole.entities.NativeDevice.filter(
      { device_token_hash: hash }, '-created_date', 1
    );
    const device = devices?.[0];
    if (!device || device.tracking_enabled === false) {
      return Response.json({ error: 'Device not registered or tracking disabled' }, { status: 403 });
    }

    const userId = device.user_id;
    const { group_ride_id, lat, lng, speed_kmh, battery_level, gps_status, riding_status, distance_km, max_speed_kmh } = body || {};
    if (!group_ride_id || lat == null || lng == null) {
      return Response.json({ error: 'Missing fields' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const existing = await svc.entities.RideParticipant.filter({ group_ride_id, user_id: userId });
    let participant = existing?.[0];
    let ride = null;
    try { ride = await svc.entities.GroupRide.get(group_ride_id); } catch (e) {}
    if (!ride) return Response.json({ error: 'Group ride not found' }, { status: 404 });

    const isLeader = ride.leader_id === userId;
    const isSweep = ride.sweep_id === userId;
    let groupMember = false;
    if (ride.group_id) {
      try {
        const gm = await svc.entities.GroupMember.filter({ group_id: ride.group_id, user_id: userId, status: 'active' });
        groupMember = !!(gm && gm.length > 0);
      } catch (e) {
        return Response.json({ error: 'Unable to verify group membership' }, { status: 503 });
      }
    }
    if (!isLeader && !isSweep && !groupMember) {
      return Response.json({ access_denied: true, reason: 'You are not a current member of this group ride' }, { status: 403 });
    }
    if (ride.status && !['waiting', 'riding', 'paused'].includes(ride.status)) {
      return Response.json({ error: 'Group ride is not active' }, { status: 409 });
    }

    let distFromLeader = null;
    if (ride?.leader_id && ride.leader_id !== userId) {
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
      const user = await svc.entities.User.get(userId);
      let bike = null;
      try { const bikes = await svc.entities.Bike.filter({ created_by_id: userId, is_primary: true }, '-created_date', 1); bike = bikes[0]; } catch (e) {}
      participant = await svc.entities.RideParticipant.create({
        group_ride_id, user_id: userId,
        user_name: user?.nickname || user?.full_name || 'Rider',
        avatar_url: user?.avatar_url || null,
        bike_make: bike?.make || null,
        bike_model: bike?.model || null,
        role: ride?.leader_id === userId ? 'leader' : (ride?.sweep_id === userId ? 'sweep' : 'member'),
        joined_at: new Date().toISOString(),
        distance_km: distance_km ?? 0,
        max_speed_kmh: max_speed_kmh ?? 0,
        ...update,
      });
    }

    // Fire-and-forget geofence check — never block location updates on it.
    try {
      const u = await svc.entities.User.get(userId);
      if (u) await runGeofenceCheck(svc, userId, u, lat, lng);
    } catch (e) { console.error('geofence check error', e); }

    return Response.json({ participant });
  } catch (error) {
    console.error('update-rider-location-native error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});