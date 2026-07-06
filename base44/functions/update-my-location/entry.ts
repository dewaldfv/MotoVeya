import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { lat, lng } = body || {};
    if (lat == null || lng == null) return Response.json({ error: 'Missing lat/lng' }, { status: 400 });

    const svc = base44.asServiceRole;

    // Respect the user's own privacy setting for live location sharing.
    let shareLiveLocation = true;
    try {
      const ps = await svc.entities.PrivacySetting.filter({ created_by_id: me.id }, '-created_date', 1);
      if (ps && ps[0] && typeof ps[0].share_live_location === 'boolean') {
        shareLiveLocation = ps[0].share_live_location;
      }
    } catch (e) { /* no settings = default true */ }

    const update = shareLiveLocation
      ? { last_lat: lat, last_lng: lng, last_location_updated: new Date().toISOString() }
      : { last_lat: null, last_lng: null, last_location_updated: null };

    await svc.entities.User.update(me.id, update);

    return Response.json({ ok: true, sharing: shareLiveLocation });
  } catch (error) {
    console.error('update-my-location error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});