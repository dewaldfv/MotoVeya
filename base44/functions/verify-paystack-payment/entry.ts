import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { reference } = body;

    if (!reference) {
      return Response.json({ error: 'reference required' }, { status: 400 });
    }

    // Authenticate caller — only the paying user may activate their own subscription
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
    const cycle = metadata.billing_cycle === 'annual' ? 'annual' : 'monthly';
    const expectedAmount = cycle === 'annual' ? 89990 : 8999;
    if (Number(tx.amount) !== expectedAmount) {
      return Response.json({ error: 'Unexpected payment amount' }, { status: 400 });
    }

    const expectedAppId = secrets.get('BASE44_APP_ID') || '';
    if (expectedAppId && metadata.base44_app_id !== expectedAppId) {
      return Response.json({ error: 'Payment is not bound to this application' }, { status: 403 });
    }

    // The payment reference must belong to the authenticated caller.
    if (!metadata.user_id || metadata.user_id !== me.id) {
      return Response.json({ error: 'Payment reference is not bound to this user' }, { status: 403 });
    }

    // Idempotently activate the subscription if the webhook hasn't already recorded it
    const svc = base44.asServiceRole;
    const existing = await svc.entities.Subscription.filter({ purchase_token: reference });
    if (existing.length === 0) {
      const amount = tx.amount / 100; // cents to ZAR
      const paidAt = new Date(tx.paid_at || Date.now());
      const periodEnd = new Date(
        paidAt.getTime() + (cycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000
      );

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
        auto_renew: true,
      });

      await svc.entities.User.update(me.id, {
        subscription_tier: 'premium',
        subscription_status: 'active',
        subscription_expiry: periodEnd.toISOString(),
      });
      console.log(`Premium activated via verify for user ${me.id} (ref ${reference})`);
    }

    return Response.json({ status: 'success', active: true });
  } catch (error) {
    console.error('verify-paystack-payment error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}