import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { rider_id, distress_alert_id, lat, lng } = body;

    if (!rider_id) {
      return Response.json({ error: 'rider_id required' }, { status: 400 });
    }

    // Authenticate caller and verify they match the rider whose stats are being logged
    let me;
    try {
      me = await base44.auth.me();
    } catch (e) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!me || me.id !== rider_id) {
      return Response.json({ error: 'You can only log incidents for yourself' }, { status: 403 });
    }

    const svc = base44.asServiceRole;

    // Fetch the rider to read their current incident count
    let user;
    try {
      user = await svc.entities.User.get(rider_id);
    } catch (e) {
      return Response.json({ error: 'Rider not found' }, { status: 404 });
    }

    // Increment the rider's total incident counter
    const currentIncidents = user.total_incidents || 0;
    await svc.entities.User.update(rider_id, {
      total_incidents: currentIncidents + 1,
    });

    // Create an in-app notification for the rider confirming the incident was logged
    try {
      await svc.entities.Notification.create({
        type: 'distress_alert',
        title: 'Incident Logged',
        body: 'Your distress alert has been logged to your riding stats. Emergency contacts and group members have been notified.',
        is_read: false,
        recipient_id: rider_id,
      });
    } catch (e) {
      console.error('Failed to create log notification:', e);
    }

    return Response.json({
      success: true,
      total_incidents: currentIncidents + 1,
    });
  } catch (error) {
    console.error('log-incident-stats error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}