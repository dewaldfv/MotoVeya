import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Allow invocation from the scheduled workflow (no user) or by an admin.
    let user = null;
    try {
      const authed = await base44.auth.isAuthenticated();
      if (authed) user = await base44.auth.me();
    } catch (e) {
      /* workflow context — no user token */
    }
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const client = user ? base44 : base44.asServiceRole;

    // Events whose date is older than 30 days ago have exited the retention window.
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const events = await client.entities.Event.filter({}, 'event_date', 500);
    const pastEvents = (events || []).filter(
      (ev) => ev.event_date && new Date(ev.event_date) < cutoff
    );

    let archivedCount = 0;
    for (const ev of pastEvents) {
      const photos = await client.entities.EventPhoto.filter(
        { event_id: ev.id, archived: false },
        '-created_date',
        500
      );
      if (photos.length === 0) continue;
      await client.entities.EventPhoto.updateMany(
        { event_id: ev.id, archived: false },
        { $set: { archived: true } }
      );
      archivedCount += photos.length;
    }

    return Response.json({
      status: 'success',
      eventsProcessed: pastEvents.length,
      photosArchived: archivedCount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}