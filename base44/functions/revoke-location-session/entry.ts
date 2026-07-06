import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { session_id, all } = body || {};
    const svc = base44.asServiceRole;
    const now = new Date().toISOString();

    if (session_id) {
      try {
        const s = await svc.entities.LocationSession.get(session_id);
        if (s && s.user_id === me.id) {
          await svc.entities.LocationSession.update(session_id, { status: 'revoked', ended_at: now });
        } else {
          return Response.json({ error: 'Not allowed' }, { status: 403 });
        }
      } catch (e) {
        console.error('revoke single error', e);
        return Response.json({ error: 'Session not found' }, { status: 404 });
      }
    } else {
      const active = await svc.entities.LocationSession.filter({ user_id: me.id, status: 'active' }, '-started_at', 50);
      for (const s of (active || [])) {
        try { await svc.entities.LocationSession.update(s.id, { status: 'revoked', ended_at: now }); } catch (e) {}
      }
    }

    // Immediately clear the live location so nobody can see a stale position.
    await svc.entities.User.update(me.id, { last_lat: null, last_lng: null, last_location_updated: null });

    return Response.json({ ok: true });
  } catch (error) {
    console.error('revoke-location-session error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});