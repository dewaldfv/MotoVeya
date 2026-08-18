import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const participantId = body?.participant_id;
    const rideId = body?.group_ride_id;
    if (!['assign_role', 'remove'].includes(action)) return Response.json({ error: 'Invalid action' }, { status: 400 });
    if (!participantId || !rideId) return Response.json({ error: 'participant_id and group_ride_id required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const ride = await svc.entities.GroupRide.get(rideId).catch(() => null);
    if (!ride) return Response.json({ error: 'Ride not found' }, { status: 404 });

    const participant = await svc.entities.RideParticipant.get(participantId).catch(() => null);
    if (!participant || participant.group_ride_id !== rideId) return Response.json({ error: 'Participant not found' }, { status: 404 });

    const isAdmin = me.role === 'admin';
    const isLeader = ride.leader_id === me.id;
    if (!isAdmin && !isLeader) return Response.json({ error: 'Only the ride leader or admin may manage participants' }, { status: 403 });

    if (action === 'assign_role') {
      const role = body?.role;
      if (!['leader', 'sweep', 'member'].includes(role)) return Response.json({ error: 'Invalid role' }, { status: 400 });
      if (role === 'leader') {
        await svc.entities.GroupRide.update(rideId, {
          leader_id: participant.user_id,
          leader_name: participant.user_name,
          sweep_id: ride.sweep_id === participant.user_id ? null : ride.sweep_id,
        });
      } else if (role === 'sweep') {
        await svc.entities.GroupRide.update(rideId, {
          sweep_id: participant.user_id,
          sweep_name: participant.user_name,
        });
      } else if (ride.leader_id === participant.user_id) {
        return Response.json({ error: 'Assign another leader before removing the leader role' }, { status: 409 });
      } else if (ride.sweep_id === participant.user_id) {
        await svc.entities.GroupRide.update(rideId, { sweep_id: null, sweep_name: null });
      }
      const updated = await svc.entities.RideParticipant.update(participantId, { role });
      return Response.json({ participant: updated });
    }

    if (participant.user_id === ride.leader_id) return Response.json({ error: 'The ride leader cannot be removed' }, { status: 409 });
    await svc.entities.RideParticipant.delete(participantId);
    if (ride.sweep_id === participant.user_id) {
      await svc.entities.GroupRide.update(rideId, { sweep_id: null, sweep_name: null });
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error('manage-group-ride-participant error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
