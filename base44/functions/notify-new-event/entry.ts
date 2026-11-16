import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { sendPushToUsers } from '../../shared/webPush.ts';

// Announces a newly approved event to every rider reachable on any device:
// one in-app Notification record plus OS-level push (browser + Android app).
// Runs as the service role so it can read other users' subscriptions and
// create notifications addressed to them.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { event_id } = body;
    if (!event_id) return Response.json({ error: 'Missing event_id' }, { status: 400 });

    const ev = await svc.entities.Event.get(event_id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!ev) return Response.json({ error: 'Event not found' }, { status: 404 });

    // Never announce unpublished/unapproved events. This function is intended
    // to run only after moderation has made the event publicly visible.
    if (ev.status !== 'approved') {
      return Response.json({ error: 'Event is not approved for publication' }, { status: 409 });
    }

    const title = `🏍️ New Event: ${ev.title}`;
    const notifBody = ev.venue_name
      ? `${ev.title} at ${ev.venue_name}. Tap to view details.`
      : `A new event "${ev.title}" has been added. Tap to view.`;
    const action_url = `/events/${ev.id}`;

    const [subs, devices] = await Promise.all([
      svc.entities.PushSubscription.list('-created_date', 500).catch((e) => {
        console.error('list subs', e.message);
        return [];
      }),
      svc.entities.NativeDevice.list('-created_date', 500).catch(() => []),
    ]);

    // Recipients: anyone reachable on a browser subscription or an Android app
    // device that still allows alerts.
    const userIds = new Set();
    (subs || []).forEach((s) => { if (s.user_id) userIds.add(s.user_id); });
    (devices || []).forEach((d) => {
      if (d.user_id && d.push_token && d.push_enabled !== false) userIds.add(d.user_id);
    });

    const notifs = [...userIds].map((recipient_id) => ({
      type: 'nearby_event',
      title,
      body: notifBody,
      recipient_id,
      is_read: false,
      data: JSON.stringify({ event_id: ev.id, type: 'new_event' }),
      action_url,
    }));
    if (notifs.length > 0) {
      await svc.entities.Notification.bulkCreate(notifs).catch((e) =>
        console.error('notif create', e.message)
      );
    }

    const result = await sendPushToUsers(svc, [...userIds], {
      title,
      body: notifBody,
      type: 'new_event',
      action_url,
      eventId: ev.id,
    });

    return Response.json({ success: true, sent: result.sent, notified: notifs.length });
  } catch (error) {
    console.error('notify-new-event error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}