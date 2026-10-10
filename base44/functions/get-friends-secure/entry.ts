import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEFAULT_PRIVACY = {
  show_motorcycle: true,
  show_weekly_stats: true,
  share_live_location: true,
  location_group_rides_only: false,
  background_sharing_enabled: false,
  location_audience: 'friends',
  post_ride_share_duration: 'immediate',
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

    // De-duplicate bidirectional friendships and collect friend user IDs.
    const friendUserIds = [];
    const seenUserIds = new Set();
    const friendMeta = []; // { friendUid, friendName, isFavorite, friendId }
    for (const f of friendRecords) {
      const isRequester = f.requester_id === me.id;
      const friendUid = isRequester ? f.recipient_id : f.requester_id;
      if (seenUserIds.has(friendUid)) continue;
      seenUserIds.add(friendUid);
      friendUserIds.push(friendUid);
      const friendName = isRequester ? f.recipient_name : f.requester_name;
      friendMeta.push({ friendUid, friendName, isFavorite: f.is_favorite || false, friendId: f.id });
    }

    if (friendUserIds.length === 0) return Response.json({ friends: [] });

    // Batch-fetch all friend profiles, privacy settings, distress/crash alerts,
    // and my ride participations in a single parallel batch — no per-friend loops.
    const [profiles, privSettings, activeDistress, activeCrashes, myParts] = await Promise.all([
      svc.entities.User.filter({ id: { $in: friendUserIds } }, '-created_date', 200),
      svc.entities.PrivacySetting.filter({ created_by_id: { $in: friendUserIds } }, '-created_date', 200),
      svc.entities.DistressAlert.filter({ status: 'active' }, '-created_date', 100),
      svc.entities.CrashAlert.filter({ status: 'active' }, '-created_date', 100),
      svc.entities.RideParticipant.filter({ user_id: me.id }, '-last_updated', 50),
    ]);

    // Index profiles and privacy by user id for O(1) lookup.
    const profileMap = new Map();
    for (const p of (profiles || [])) profileMap.set(p.id, p);
    const privacyMap = new Map();
    for (const ps of (privSettings || [])) {
      if (!privacyMap.has(ps.created_by_id)) privacyMap.set(ps.created_by_id, ps);
    }

    // Distress/crash map by rider_id.
    const distressMap = new Map();
    for (const d of [...(activeDistress || []), ...(activeCrashes || [])]) {
      if (d.rider_id && !distressMap.has(d.rider_id)) distressMap.set(d.rider_id, d);
    }

    // Determine active group ride IDs (batch fetch rides instead of per-participant).
    const rideIds = [...new Set((myParts || []).map((p) => p.group_ride_id).filter(Boolean))];
    const activeRideIds = new Set();
    if (rideIds.length > 0) {
      const rides = await svc.entities.GroupRide.filter({ id: { $in: rideIds } }, '-created_date', 50);
      for (const r of (rides || [])) {
        if (ACTIVE_RIDE_STATES.includes(r.status)) activeRideIds.add(r.id);
      }
    }

    const friends = [];
    for (const { friendUid, friendName, isFavorite, friendId } of friendMeta) {
      const profile = profileMap.get(friendUid) || null;

      // Load the friend's privacy settings (their choices about what to share).
      const ps = privacyMap.get(friendUid);
      const privacy = { ...DEFAULT_PRIVACY, ...(ps || {}) };

      // Live location — read from the friend's own User profile, gated by their audience choice.
      // The last known position is returned even when stale so offline friends
      // remain visible on the map; is_online distinguishes fresh vs stale fixes.
      const fLat = profile?.last_lat;
      const fLng = profile?.last_lng;
      const fUpdated = profile?.last_location_updated;
      const locFresh = fUpdated && (Date.now() - new Date(fUpdated).getTime() < 10 * 60 * 1000);
      const audience = privacy.location_audience
        || (privacy.location_group_rides_only ? 'group_rides' : (privacy.share_live_location ? 'friends' : 'nobody'));
      let lat = null;
      let lng = null;
      let location_shared = false;
      let is_online = false;
      if (audience !== 'nobody' && fLat != null && fLng != null) {
        let reveal = false;
        if (audience === 'friends' || audience === 'group_rides') {
          reveal = true;
        } else if (audience === 'favorite_friends') {
          reveal = isFavorite;
        }
        if (reveal) {
          lat = fLat;
          lng = fLng;
          location_shared = true;
          is_online = !!locFresh;
        }
      }

      const hasDistress = distressMap.has(friendUid);
      const lastSeenAt = profile?.last_seen_at || null;
      const online = !!(lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < 3 * 60 * 1000);
      friends.push({
        friend_id: friendId,
        user_id: friendUid,
        name: profile?.nickname || profile?.full_name || friendName || 'Rider',
        nickname: profile?.nickname || null,
        avatar_url: profile?.avatar_url || null,
        lat,
        lng,
        location_shared,
        is_online,
        speed_kmh: location_shared ? (profile?.last_speed_kmh ?? 0) : 0,
        heading: location_shared ? (profile?.last_heading ?? null) : null,
        battery_level: location_shared ? (profile?.battery_level ?? null) : null,
        last_updated: location_shared ? fUpdated : null,
        is_favorite: isFavorite,
        distress: hasDistress,
        phone: hasDistress ? (profile?.phone || null) : null,
        share_live_location: privacy.share_live_location,
        location_group_rides_only: privacy.location_group_rides_only,
        online,
        last_seen_at: lastSeenAt,
      });
    }

    return Response.json({ friends });
  } catch (error) {
    console.error('get-friends-secure error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});