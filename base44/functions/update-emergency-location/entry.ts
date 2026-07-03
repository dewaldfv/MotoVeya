import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { alert_id, lat, lng } = await req.json();
    if (!alert_id || lat == null || lng == null) {
      return Response.json({ error: 'alert_id, lat, lng required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    await base44.entities.CrashAlert.update(alert_id, {
      last_lat: lat,
      last_lng: lng,
      last_updated: now,
    });

    try {
      const distress = await base44.entities.DistressAlert.filter({ rider_id: user.id, status: 'active' }, '-created_date', 1);
      if (distress.length > 0) {
        await base44.entities.DistressAlert.update(distress[0].id, {
          last_lat: lat,
          last_lng: lng,
          last_updated: now,
        });
      }
    } catch (e) { console.error(e); }

    return Response.json({ success: true, last_updated: now });
  } catch (error) {
    console.error('Location update error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});