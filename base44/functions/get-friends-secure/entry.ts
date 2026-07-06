import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEFAULT_PRIVACY = {
  show_motorcycle: true,
  show_weekly_stats: true,
  share_live_location: true,
  location_group_rides_only: false,
  show_completed_rides: true,
  show_events: true,
  show_achievements: true,
  show_fuel_stats: false,
  show_photos: true,
};

const ACTIVE_RIDE_STATES = ['waiting', 'riding', 'paused'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;

    // Accepted friends in both directions (service role — both parties need access).
    const [asReq, asRec] = await Promise.all([
      svc.entities.Friend.filter({ requester_id: me.id, status: 'accepted' }, '-created_date', 200),
      svc.entities.Friend.filter({ recipient_id: me.id, status: 'accepted' }, '-created_date', 200),
    ]);
    const friendRecords = [...(asReq || []), ...(asRec || [])];

    // Determine which active group rides the current user is in (for location_group_rides_only).
    const myParts = (await svc.entities.RideParticipant.filter({ user_id: me.id }, '-last_updated', 50)) || [];
    const activeRideIds = [];
    for (const p of myParts) {
      try {
        const r = await svc.entities.GroupRide.get(p.group_ride_id);
        if (ACTIVE_RIDE_STATES.includes(r.status)) activeRideIds.push(p.group_ride_id);
      } catch (e) { /* ride may have been deleted */ }
    }

    const friends = [];
    const seenUserIds = new Set();
    for (const f of friendRecords) {
      const isRequester = f.requester_id === me.id;
      const friendUid = isRequester ? f.recipient_id : f.requester_id;
      if (seenUserIds.has(friendUid)) continue; // deduplicate bidirectional friendships
      seenUserIds.add(friendUid);
      const friendName = isRequester ? f.recipient_name : f.requester_name;

      // Load the friend's public profile.
      let profile = null;
      try { profile = await svc.entities.User.get(friendUid); } catch (e) { /* private user */ }

      // Load the friend's privacy settings (their choices about what to share).
      let privacy = { ...DEFAULT_PRIVACY };
      try {
        const ps = await svc.entities.PrivacySetting.filter({ created_by_id: friendUid }, '-created_date', 1);
        if (ps && ps[0]) privacy = { ...privacy, ...ps[0] };
      } catch (e) { /* no settings = defaults */ }

      // Motorcycle info — gated by the owner's privacy setting.
      let bike = null;
      if (privacy.show_motorcycle) {
        try {
          const bikes = await svc.entities.Bike.filter({ created_by_id: friendUid, is_primary: true }, '-created_date', 1);
          bike = bikes[0] || null;
          if (!bike) {
            const all = await svc.entities.Bike.filter({ created_by_id: friendUid }, '-created_date', 1);
            bike = all[0] || null;
          }
        } catch (e) {}
      }

      // Live location — read from the friend's own User profile, gated by their privacy.
      const fLat = profile?.last_lat;
      const fLng = profile?.last_lng;
      let lat = null;
      let lng = null;
      let location_shared = false;
      if (privacy.share_live_location && fLat != null && fLng != null) {
        location_shared = true;
        if (privacy.location_group_rides_only) {
          // Only reveal location if both riders are in an active group ride together.
          let inSharedRide = false;
          if (activeRideIds.length > 0) {
            for (const rid of activeRideIds) {
              try {
                const fp = await svc.entities.RideParticipant.filter({ group_ride_id: rid, user_id: friendUid });
                if (fp && fp.length > 0) { inSharedRide = true; break; }
              } catch (e) {}
            }
          }
          if (inSharedRide) { lat = fLat; lng = fLng; }
          else { location_shared = false; }
        } else {
          lat = fLat;
          lng = fLng;
        }
      }

      friends.push({
        friend_id: f.id,
        user_id: friendUid,
        name: profile?.nickname || profile?.full_name || friendName || 'Rider',
        nickname: profile?.nickname || null,
        avatar_url: profile?.avatar_url || null,
        bio: profile?.bio || null,
        motorcycle_club: profile?.motorcycle_club || null,
        bike_make: bike?.make || null,
        bike_model: bike?.model || null,
        bike_nickname: bike?.nickname || null,
        lat,
        lng,
        location_shared,
        share_live_location: privacy.share_live_location,
        location_group_rides_only: privacy.location_group_rides_only,
      });
    }

    return Response.json({ friends });
  } catch (error) {
    console.error('get-friends-secure error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});