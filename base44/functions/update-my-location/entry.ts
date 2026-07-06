import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEFAULT_PRIVACY = {
  share_live_location: true,
  background_sharing_enabled: false,
  location_audience: 'friends',
  location_group_rides_only: false,
  post_ride_share_duration: 'immediate',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { lat, lng, speed_kmh, source, end_session } = body || {};

    const svc = base44.asServiceRole;

    // Load the user's own privacy settings.
    let privacy = { ...DEFAULT_PRIVACY };
    try {
      const ps = await svc.entities.PrivacySetting.filter({ created_by_id: me.id }, '-created_date', 1);
      if (ps && ps[0]) privacy = { ...privacy, ...ps[0] };
    } catch (e) { /* no settings = defaults */ }

    // Effective consent: explicit background sharing enabled AND audience is not "nobody".
    const bgEnabled = privacy.background_sharing_enabled != null
      ? privacy.background_sharing_enabled
      : privacy.share_live_location;
    const audience = privacy.location_audience
      || (privacy.location_group_rides_only ? 'group_rides' : (privacy.share_live_location ? 'friends' : 'nobody'));
    const consent = bgEnabled === true && audience !== 'nobody';

    // Helper: expire any active sessions for this user.
    const expireActiveSessions = async () => {
      try {
        const active = await svc.entities.LocationSession.filter({ user_id: me.id, status: 'active' }, '-started_at', 10);
        for (const s of (active || [])) {
          await svc.entities.LocationSession.update(s.id, { status: 'expired', ended_at: new Date().toISOString() });
        }
      } catch (e) { console.error('expire sessions error', e); }
    };

    // Explicit end (ride ended, user revoked, permission lost).
    if (end_session) {
      await expireActiveSessions();
      await svc.entities.User.update(me.id, { last_lat: null, last_lng: null, last_location_updated: null });
      return Response.json({ ok: true, sharing: false });
    }

    // No consent or missing coordinates — clear location and stop sessions.
    if (!consent || lat == null || lng == null) {
      if (!consent) {
        await expireActiveSessions();
        await svc.entities.User.update(me.id, { last_lat: null, last_lng: null, last_location_updated: null });
      }
      return Response.json({ ok: true, sharing: false });
    }

    // Consent OK — update live location and upsert the active session.
    const now = new Date().toISOString();
    await svc.entities.User.update(me.id, { last_lat: lat, last_lng: lng, last_location_updated: now });

    let sessionId = null;
    try {
      const active = await svc.entities.LocationSession.filter({ user_id: me.id, status: 'active' }, '-started_at', 1);
      if (active && active[0]) {
        sessionId = active[0].id;
        await svc.entities.LocationSession.update(sessionId, {
          last_lat: lat, last_lng: lng, last_speed_kmh: speed_kmh ?? null,
          last_updated: now, audience, source: source || active[0].source || 'manual',
        });
      } else {
        const created = await svc.entities.LocationSession.create({
          user_id: me.id, user_name: me.full_name || null, status: 'active',
          source: source || 'manual', started_at: now, last_lat: lat, last_lng: lng,
          last_speed_kmh: speed_kmh ?? null, last_updated: now, audience,
        });
        sessionId = created?.id || null;
      }
    } catch (e) { console.error('session upsert error', e); }

    return Response.json({ ok: true, sharing: true, session_id: sessionId });
  } catch (error) {
    console.error('update-my-location error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});