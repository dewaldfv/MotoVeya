import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Admin-only broadcast: sends a push notification and an email to every
// registered app user. Used here to announce that testing is active.
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

    // List all users as the service role.
    let users: any[] = [];
    try {
      users = await svc.entities.User.list('-created_date', 1000);
    } catch (e) {
      console.error('list users', e.message);
    }

    let pushSent = 0;
    let pushFailed = 0;
    let emailsSent = 0;
    let emailFailed = 0;

    for (const u of users || []) {
      if (u.id) {
        try {
          await svc.integrations.Core.SendPushNotification({
            user_id: u.id,
            title,
            content: message,
          });
          pushSent += 1;
        } catch (e) {
          pushFailed += 1;
        }
      }
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
      push_sent: pushSent,
      push_failed: pushFailed,
      emails_sent: emailsSent,
      email_failed: emailFailed,
    });
  } catch (error) {
    console.error('broadcast-testing-active error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}