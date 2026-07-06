import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ACTIVE_RIDE_STATES = ['waiting', 'riding', 'paused'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const rideId = body?.id;
    if (!rideId) return Response.json({ error: 'Missing ride id' }, { status: 400 });

    const svc = base44.asServiceRole;

    // Load the ride.
    let ride = null;
    try { ride = await svc.entities.GroupRide.get(rideId); } catch (e) { /* not found */ }
    if (!ride) return Response.json({ access_denied: true, reason: 'Ride not found' });

    // Membership check: is the requester a participant, assigned leader/sweep, or group member?
    let myParticipation = null;
    try {
      const parts = await svc.entities.RideParticipant.filter({ group_ride_id: rideId, user_id: me.id });
      myParticipation = parts?.[0] || null;
    } catch (e) {}

    const isLeader = ride.leader_id === me.id;
    const isSweep = ride.sweep_id === me.id;

    if (!myParticipation && !isLeader && !isSweep) {
      // Fallback: check group membership (the ride may belong to a group the user is in).
      let groupMember = false;
      if (ride.group_id) {
        try {
          const gm = await svc.entities.GroupMember.filter({ group_id: ride.group_id, user_id: me.id, status: 'active' });
          groupMember = !!(gm && gm.length > 0);
        } catch (e) {}
      }
      if (!groupMember) {
        return Response.json({ access_denied: true, reason: 'You are not a member of this group ride' });
      }
    }

    // Load all participants.
    let participants = [];
    try { participants = await svc.entities.RideParticipant.filter({ group_ride_id: rideId }, '-last_updated', 100); } catch (e) {}

    // Privacy: once a ride is finished, strip live location data — only summary info remains.
    const isActive = ACTIVE_RIDE_STATES.includes(ride.status);
    if (!isActive) {
      participants = (participants || []).map((p) => ({
        ...p,
        lat: null,
        lng: null,
        speed_kmh: null,
        distance_from_leader_km: null,
        gps_status: null,
        battery_level: null,
      }));
    }

    return Response.json({ ride, participants, my_participation: myParticipation, is_active: isActive });
  } catch (error) {
    console.error('get-group-ride-secure error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});