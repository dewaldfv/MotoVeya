import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { sendPushToUsers } from '../../shared/webPush.ts';

// Admin-only broadcast: sends a Web Push notification, an in-app Notification
// record, and an email to every registered app user. Web Push reaches browser
// and PWA subscribers; native push is attempted as a secondary channel for
// native app users where push credentials are configured.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const title = (body && body.title) || 'Testing is Active';
    const message =
      (body && body.message) ||
      'MotoVeya testing is currently active. Thanks for being part of the community!';

    // List all users for email and native push.
    let users: any[] = [];
    try {
      users = await svc.entities.User.list('-created_date', 1000);
    } catch (e) {
      console.error('list users', e.message);
    }

    // Collect stored Web Push subscriptions to know who has push enabled and
    // to create in-app Notification records for each subscribed user.
    let subs: any[] = [];
    try {
      subs = await svc.entities.PushSubscription.list('-created_date', 1000);
    } catch (e) {
      console.error('list subs', e.message);
    }

    const subUserIds = [...new Set((subs || []).map((s) => s.user_id).filter(Boolean))];

    // In-app Notification records — visible in the app's notification center
    // even if the push itself is missed (app closed, permission revoked, etc).
    const notifs = subUserIds.map((recipient_id) => ({
      type: 'nearby_event',
      title,
      body: message,
      recipient_id,
      is_read: false,
      data: JSON.stringify({ type: 'broadcast' }),
      action_url: '/',
    }));
    if (notifs.length > 0) {
      await svc.entities.Notification.bulkCreate(notifs).catch((e) =>
        console.error('notif create', e.message)
      );
    }

    // Web Push — the primary push channel for browser/PWA users.
    const pushPayload = {
      title,
      body: message,
      type: 'broadcast',
      action_url: '/',
    };
    const webPushResult = await sendPushToUsers(svc, subUserIds, pushPayload);

    // Native push — secondary channel for native app users. Only counts as
    // sent when the integration actually delivers (requires a native mobile
    // build with push credentials configured).
    let nativePushSent = 0;
    let nativePushFailed = 0;
    for (const u of users || []) {
      if (u.id) {
        try {
          await svc.integrations.Core.SendPushNotification({
            user_id: u.id,
            title,
            content: message,
          });
          nativePushSent += 1;
        } catch (e) {
          nativePushFailed += 1;
        }
      }
    }

    // Email — sent to every registered user with an email address.
    let emailsSent = 0;
    let emailFailed = 0;
    for (const u of users || []) {
      if (u.email) {
        try {
          await svc.integrations.Core.SendEmail({
            to: u.email,
            subject: title,
            body: message,
          });
          emailsSent += 1;
        } catch (e) {
          emailFailed += 1;
        }
      }
    }

    return Response.json({
      success: true,
      total_users: (users || []).length,
      push_sent: (webPushResult?.sent || 0) + nativePushSent,
      push_failed: nativePushFailed,
      web_push_sent: webPushResult?.sent || 0,
      native_push_sent: nativePushSent,
      in_app_notified: notifs.length,
      emails_sent: emailsSent,
      email_failed: emailFailed,
    });
  } catch (error) {
    console.error('broadcast-testing-active error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}