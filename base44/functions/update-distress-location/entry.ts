import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { rider_id, lat, lng, distress_alert_id } = body;

    if (!rider_id || lat == null || lng == null) {
      return Response.json({ error: 'rider_id, lat, lng required' }, { status: 400 });
    }

    // Authenticate caller and verify they own the location being updated
    let me;
    try {
      me = await base44.auth.me();
    } catch (e) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!me || me.id !== rider_id) {
      return Response.json({ error: 'You can only update your own location' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const svc = base44.asServiceRole;

    // Update the rider's live location on their User entity
    try {
      await svc.entities.User.update(rider_id, {
        last_lat: lat,
        last_lng: lng,
        last_location_updated: now,
      });
    } catch (e) {
      console.error('Failed to update user location:', e);
    }

    // A distress alert is a safety-critical record. Never allow an authenticated
    // rider to update an alert that belongs to somebody else.
    if (distress_alert_id) {
      const alert = await svc.entities.DistressAlert.get(distress_alert_id).catch(() => null);
      if (!alert) {
        return Response.json({ error: 'Distress alert not found' }, { status: 404 });
      }
      if (alert.rider_id !== me.id) {
        console.warn(`Blocked distress-location ownership violation: user=${me.id} alert=${distress_alert_id}`);
        return Response.json({ error: 'You can only update your own distress alert' }, { status: 403 });
      }
      if (alert.status && alert.status !== 'active') {
        return Response.json({ error: 'Distress alert is no longer active' }, { status: 409 });
      }
      try {
        await svc.entities.DistressAlert.update(distress_alert_id, {
          last_lat: lat,
          last_lng: lng,
          last_updated: now,
        });
      } catch (e) {
        console.error('Failed to update distress alert:', e);
        return Response.json({ error: 'Unable to update distress alert' }, { status: 500 });
      }
    }

    return Response.json({ success: true, last_updated: now });
  } catch (error) {
    console.error('update-distress-location error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}