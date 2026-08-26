import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

async function verifyPaystackSignature(body, signatureHeader, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expectedHex = Array.from(new Uint8Array(expected))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return expectedHex === signatureHeader;
}

export default async function(req) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    const secret = secrets.get('PAYSTACK_SECRET_KEY');

    if (!signature || !secret) {
      return Response.json({ error: 'Missing signature or secret' }, { status: 400 });
    }

    const isValid = await verifyPaystackSignature(body, signature, secret);
    if (!isValid) {
      console.error('Paystack webhook signature verification failed');
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);
    const base44 = createClientFromRequest(req).asServiceRole;

    if (event.event === 'charge.success') {
      const data = event.data;
      const metadata = data.metadata || {};
      const userId = metadata.user_id;
      if (!userId) {
        console.error('Paystack charge.success missing metadata.user_id');
        return Response.json({ error: 'Missing payment user binding' }, { status: 400 });
      }
      const cycle = metadata.billing_cycle === 'annual' ? 'annual' : 'monthly';
      const reference = data.reference;
      if (!reference) {
        return Response.json({ error: 'Missing payment reference' }, { status: 400 });
      }
      if (data.currency !== 'ZAR') {
        return Response.json({ error: 'Unexpected payment currency' }, { status: 400 });
      }
      const expectedAmount = cycle === 'annual' ? 89990 : 8999;
      if (Number(data.amount) !== expectedAmount) {
        return Response.json({ error: 'Unexpected payment amount' }, { status: 400 });
      }
      const expectedAppId = secrets.get('BASE44_APP_ID') || '';
      if (expectedAppId && metadata.base44_app_id !== expectedAppId) {
        return Response.json({ error: 'Payment is not bound to this application' }, { status: 403 });
      }
      const referencePrefix = `motogo_${cycle}_`;
      if (typeof reference !== 'string' || !reference.startsWith(referencePrefix)) {
        return Response.json({ error: 'Unexpected payment reference' }, { status: 400 });
      }
      const amount = data.amount / 100; // cents to ZAR
      const paidAt = new Date(data.paid_at || Date.now());
      const periodEnd = new Date(
        paidAt.getTime() + (cycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000
      );

      // Avoid duplicate processing for the same reference
      const existing = await base44.entities.Subscription.filter({ purchase_token: reference });
      if (existing.length === 0) {
        await base44.entities.Subscription.create({
          user_id: userId,
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

        if (userId) {
          await base44.entities.User.update(userId, {
            subscription_tier: 'premium',
            subscription_status: 'active',
            subscription_expiry: periodEnd.toISOString(),
          });
        }
        console.log(`Premium activated for user ${userId} via Paystack (ref ${reference})`);
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}