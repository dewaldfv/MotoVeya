import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { secrets } from 'base44:runtime';
import webpush from 'npm:web-push@3.6.7';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = secrets.get('VAPID_PUBLIC_KEY');
  const privateKey = secrets.get('VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey) {
    throw new Error('VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY not set');
  }
  webpush.setVapidDetails('mailto:support@motogo.app', publicKey, privateKey);
  vapidConfigured = true;
}

// Send a Web Push notification to every stored subscription (all app users),
// and create an in-app Notification record for each subscribed user. Runs as
// the service role so it can read other users' subscriptions and create
// notifications addressed to them. Expired/invalid subscriptions are pruned.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { event_id } = body;
    if (!event_id) return Response.json({ error: 'Missing event_id' }, { status: 400 });

    const ev = await svc.entities.Event.get(event_id).catch(() => null);
    if (!ev) return Response.json({ error: 'Event not found' }, { status: 404 });

    const title = `🏍️ New Event: ${ev.title}`;
    const notifBody = ev.venue_name
      ? `${ev.title} at ${ev.venue_name}. Tap to view details.`
      : `A new event "${ev.title}" has been added. Tap to view.`;
    const action_url = `/events/${ev.id}`;

    let subs = [];
    try {
      subs = await svc.entities.PushSubscription.list('-created_date', 500);
    } catch (e) {
      console.error('list subs', e.message);
    }

    // One in-app Notification per subscribed user.
    const userIds = new Set();
    (subs || []).forEach((s) => { if (s.user_id) userIds.add(s.user_id); });
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

    // Web push to every subscription.
    let sent = 0;
    try {
      ensureVapid();
    } catch (e) {
      console.error('ensureVapid', e.message);
      return Response.json({ sent: 0, notified: notifs.length, error: e.message });
    }
    const payloadStr = JSON.stringify({
      title,
      body: notifBody,
      type: 'new_event',
      action_url,
      eventId: ev.id,
    });
    await Promise.all(
      (subs || []).map((s) =>
        webpush
          .sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } },
            payloadStr
          )
          .then(() => { sent += 1; })
          .catch(async (err) => {
            const status = err && err.statusCode;
            if (status === 404 || status === 410) {
              try { await svc.entities.PushSubscription.delete(s.id); } catch (e) {}
            }
          })
      )
    );

    return Response.json({ success: true, sent, notified: notifs.length });
  } catch (error) {
    console.error('notify-new-event error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});