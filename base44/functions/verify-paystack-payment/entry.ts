import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

const MONTHLY_PERIOD_DAYS = 30;
const EXPECTED_AMOUNT = 8999;

// Extract subscription_code + email_token from the verify response.
// Paystack includes a `subscription` object on plan-based transaction verifications.
function extractSubscriptionInfo(tx) {
  if (tx.subscription && typeof tx.subscription === 'object') {
    return {
      subscription_code: tx.subscription.subscription_code || null,
      email_token: tx.subscription.email_token || null,
    };
  }
  if (tx.subscription && typeof tx.subscription === 'string') {
    return { subscription_code: tx.subscription, email_token: null };
  }
  if (tx.subscription_code) {
    return { subscription_code: tx.subscription_code, email_token: tx.email_token || null };
  }
  return null;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { reference } = body;

    if (!reference) {
      return Response.json({ error: 'reference required' }, { status: 400 });
    }

    let me;
    try {
      me = await base44.auth.me();
    } catch (e) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const secret = secrets.get('PAYSTACK_SECRET_KEY');
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { 'Authorization': `Bearer ${secret}` },
    });
    const data = await res.json();

    if (!res.ok || !data.status) {
      console.error('Paystack verify error:', JSON.stringify(data));
      return Response.json({ error: data.message || 'Verification failed' }, { status: 400 });
    }

    const tx = data.data;
    if (tx.status !== 'success') {
      return Response.json({ status: tx.status, active: false });
    }

    if (tx.currency !== 'ZAR') {
      return Response.json({ error: 'Unexpected payment currency' }, { status: 400 });
    }

    const metadata = tx.metadata || {};
    const cycle = 'monthly';
    if (Number(tx.amount) !== EXPECTED_AMOUNT) {
      return Response.json({ error: 'Unexpected payment amount' }, { status: 400 });
    }

    const expectedAppId = secrets.get('BASE44_APP_ID') || '';
    if (expectedAppId && metadata.base44_app_id !== expectedAppId) {
      return Response.json({ error: 'Payment is not bound to this application' }, { status: 403 });
    }

    if (!metadata.user_id || metadata.user_id !== me.id) {
      return Response.json({ error: 'Payment reference is not bound to this user' }, { status: 403 });
    }

    const subInfo = extractSubscriptionInfo(tx);
    const svc = base44.asServiceRole;
    const existing = await svc.entities.Subscription.filter({ purchase_token: reference });

    if (existing.length === 0) {
      const amount = tx.amount / 100;
      const paidAt = new Date(tx.paid_at || Date.now());
      const periodEnd = new Date(paidAt.getTime() + MONTHLY_PERIOD_DAYS * 24 * 60 * 60 * 1000);

      // Check if a subscription record already exists (e.g. from subscription.create event).
      const userSubs = await svc.entities.Subscription.filter(
        { user_id: me.id, plan: 'premium', payment_provider: 'paystack' },
        '-created_date',
        10
      );
      const existingSub = userSubs[0];

      if (existingSub) {
        // Update the existing record with this payment's reference and subscription code.
        await svc.entities.Subscription.update(existingSub.id, {
          status: 'active',
          renewal_date: periodEnd.toISOString(),
          expiry_date: periodEnd.toISOString(),
          grace_until: null,
          purchase_token: reference,
          paystack_subscription_code: subInfo?.subscription_code || existingSub.paystack_subscription_code || null,
          paystack_email_token: subInfo?.email_token || existingSub.paystack_email_token || null,
          auto_renew: true,
        });
      } else {
        await svc.entities.Subscription.create({
          user_id: me.id,
          plan: 'premium',
          status: 'active',
          billing_cycle: cycle,
          amount_zar: amount,
          purchase_date: paidAt.toISOString(),
          renewal_date: periodEnd.toISOString(),
          expiry_date: periodEnd.toISOString(),
          purchase_token: reference,
          payment_provider: 'paystack',
          paystack_plan_code: metadata.paystack_plan_code || null,
          paystack_subscription_code: subInfo?.subscription_code || null,
          paystack_email_token: subInfo?.email_token || null,
          auto_renew: true,
        });
      }

      await svc.entities.User.update(me.id, {
        subscription_tier: 'premium',
        subscription_status: 'active',
        subscription_expiry: periodEnd.toISOString(),
      });
      console.log(`Premium activated via verify for user ${me.id} (ref ${reference})`);
    } else if (subInfo?.subscription_code && !existing[0].paystack_subscription_code) {
      // Backfill subscription code if the webhook didn't capture it yet.
      await svc.entities.Subscription.update(existing[0].id, {
        paystack_subscription_code: subInfo.subscription_code,
        paystack_email_token: subInfo.email_token || existing[0].paystack_email_token || null,
      });
    }

    return Response.json({ status: 'success', active: true });
  } catch (error) {
    console.error('verify-paystack-payment error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}