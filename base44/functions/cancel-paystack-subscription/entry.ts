import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

/** Cancels a user's Paystack subscription at period end. Premium stays active until expiry_date. */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const subs = await svc.entities.Subscription.filter(
      { user_id: me.id, plan: 'premium', payment_provider: 'paystack' },
      '-created_date',
      10
    );

    const activeSub = subs.find((s) => ['active', 'past_due'].includes(s.status));
    if (!activeSub) {
      return Response.json({ error: 'No active subscription to cancel' }, { status: 400 });
    }

    if (!activeSub.paystack_subscription_code || !activeSub.paystack_email_token) {
      return Response.json({ error: 'Missing subscription credentials — please contact support' }, { status: 400 });
    }

    // Call Paystack's disable-subscription API.
    const response = await fetch('https://api.paystack.co/subscription/disable', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secrets.get('PAYSTACK_SECRET_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: activeSub.paystack_subscription_code,
        token: activeSub.paystack_email_token,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
      console.error('Paystack disable error:', JSON.stringify(data));
      return Response.json({ error: data.message || 'Failed to cancel subscription' }, { status: 400 });
    }

    // Mark the subscription as cancelled — keep expiry_date intact so premium lasts until period end.
    await svc.entities.Subscription.update(activeSub.id, {
      status: 'cancelled',
      auto_renew: false,
    });

    // In-app notification.
    const expiryStr = activeSub.expiry_date
      ? new Date(activeSub.expiry_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'the end of your current period';

    await svc.entities.Notification.create({
      type: 'group_update',
      title: 'Subscription Cancelled',
      body: `Your Premium subscription has been cancelled. You'll keep Premium access until ${expiryStr}, then revert to Free.`,
      recipient_id: me.id,
      is_read: false,
      data: JSON.stringify({ subscription_id: activeSub.id, expiry_date: activeSub.expiry_date }),
      action_url: '/premium',
    }).catch(() => {});

    // Email confirmation.
    try {
      if (me.email) {
        await svc.integrations.Core.SendEmail({
          to: me.email,
          subject: 'MotoVeya Premium — Subscription Cancelled',
          body: `Hi ${me.full_name || 'Rider'},\n\nYour MotoVeya Premium subscription has been cancelled. You'll keep Premium access until ${expiryStr}, after which it will revert to the Free plan.\n\nYou can re-subscribe anytime from the app.\n\n— The MotoVeya Team`,
        });
      }
    } catch (e) {
      console.error('cancel email', e.message);
    }

    return Response.json({ success: true, expiry_date: activeSub.expiry_date });
  } catch (error) {
    console.error('cancel-paystack-subscription error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}