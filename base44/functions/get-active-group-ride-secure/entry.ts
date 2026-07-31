import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ACTIVE_RIDE_STATES = ['waiting', 'riding', 'paused'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;

    // Find the current user's participant records (most recently updated first).
    let myParts = [];
    try {
      myParts = await svc.entities.RideParticipant.filter({ user_id: me.id }, '-last_updated', 20);
    } catch (e) { /* none */ }

    // Walk them to find the first whose group ride is still active.
    let activeRide = null;
    for (const p of myParts || []) {
      if (!p.group_ride_id) continue;
      let ride = null;
      try { ride = await svc.entities.GroupRide.get(p.group_ride_id); } catch (e) { continue; }
      if (ride && ACTIVE_RIDE_STATES.includes(ride.status)) {
        activeRide = ride;
        break;
      }
    }

    if (!activeRide) return Response.json({ active: false });

    // Load all participants for the active ride (membership is implied — the
    // requester has a participant record for this ride).
    let participants = [];
    try {
      participants = await svc.entities.RideParticipant.filter({ group_ride_id: activeRide.id }, '-last_updated', 100);
    } catch (e) { /* none */ }

    // Bike details are private to the owner — strip them from participants. Live
    // location/status remain visible to co-members during the active ride.
    const strippedParticipants = (participants || []).map((p) => ({ ...p, bike_make: null, bike_model: null }));

    return Response.json({
      active: true,
      ride: activeRide,
      participants: strippedParticipants,
    });
  } catch (error) {
    console.error('get-active-group-ride-secure error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});