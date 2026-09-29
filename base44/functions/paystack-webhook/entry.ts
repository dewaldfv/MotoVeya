import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

const GRACE_PERIOD_DAYS = 7;
const MONTHLY_PERIOD_DAYS = 30;
const EXPECTED_AMOUNT = 8999;

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

// Paystack sends subscription info in different shapes depending on the event.
// charge.success: data.subscription is an object with subscription_code, email_token, next_payment_date
// subscription.create / subscription.disable: data.subscription_code and data.email_token are top-level
function extractSubscriptionInfo(data) {
  if (data.subscription && typeof data.subscription === 'object') {
    return {
      subscription_code: data.subscription.subscription_code || null,
      email_token: data.subscription.email_token || null,
    };
  }
  if (data.subscription_code) {
    return {
      subscription_code: data.subscription_code,
      email_token: data.email_token || null,
    };
  }
  return null;
}

// Resolve the user from metadata, subscription_code, or customer email.
async function resolveUserId(svc, data, metadata) {
  if (metadata.user_id) return metadata.user_id;

  const subInfo = extractSubscriptionInfo(data);
  if (subInfo?.subscription_code) {
    try {
      const subs = await svc.entities.Subscription.filter({ paystack_subscription_code: subInfo.subscription_code });
      if (subs.length > 0) return subs[0].user_id;
    } catch (e) { /* ignore */ }
  }

  const email = data.customer?.email;
  if (email) {
    try {
      const users = await svc.entities.User.filter({ email });
      if (users.length > 0) return users[0].id;
    } catch (e) { /* ignore */ }
  }

  return null;
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
    const eventType = event.event;
    const data = event.data || {};
    const metadata = data.metadata || {};

    // ---- charge.success (initial + recurring) ----
    if (eventType === 'charge.success') {
      const reference = data.reference;
      if (!reference) return Response.json({ received: true });

      if (data.currency !== 'ZAR') {
        console.error(`charge.success: unexpected currency ${data.currency}`);
        return Response.json({ error: 'Unexpected currency' }, { status: 400 });
      }
      if (Number(data.amount) !== EXPECTED_AMOUNT) {
        console.error(`charge.success: unexpected amount ${data.amount}`);
        return Response.json({ error: 'Unexpected amount' }, { status: 400 });
      }

      // App binding: if metadata carries an app id, it must match.
      const expectedAppId = secrets.get('BASE44_APP_ID') || '';
      if (expectedAppId && metadata.base44_app_id && metadata.base44_app_id !== expectedAppId) {
        return Response.json({ error: 'Payment not bound to this app' }, { status: 403 });
      }

      const userId = await resolveUserId(base44, data, metadata);
      if (!userId) {
        console.error('charge.success: could not resolve user');
        return Response.json({ error: 'Could not resolve user' }, { status: 400 });
      }

      const subInfo = extractSubscriptionInfo(data);

      // Idempotency: skip if we already processed this reference.
      const existing = await base44.entities.Subscription.filter({ purchase_token: reference });
      if (existing.length > 0) {
        // Backfill subscription code if we now have it.
        if (subInfo?.subscription_code && !existing[0].paystack_subscription_code) {
          await base44.entities.Subscription.update(existing[0].id, {
            paystack_subscription_code: subInfo.subscription_code,
            paystack_email_token: subInfo.email_token || existing[0].paystack_email_token || null,
          });
        }
        return Response.json({ received: true });
      }

      const paidAt = new Date(data.paid_at || Date.now());
      const periodEnd = new Date(paidAt.getTime() + MONTHLY_PERIOD_DAYS * 24 * 60 * 60 * 1000);

      // For recurring charges, extend the existing subscription record.
      const userSubs = await base44.entities.Subscription.filter(
        { user_id: userId, plan: 'premium', payment_provider: 'paystack' },
        '-created_date',
        10
      );
      const existingSub = userSubs[0];

      if (existingSub) {
        await base44.entities.Subscription.update(existingSub.id, {
          status: 'active',
          renewal_date: periodEnd.toISOString(),
          expiry_date: periodEnd.toISOString(),
          grace_until: null,
          auto_renew: true,
          paystack_subscription_code: subInfo?.subscription_code || existingSub.paystack_subscription_code || null,
          paystack_email_token: subInfo?.email_token || existingSub.paystack_email_token || null,
          purchase_token: reference,
        });
      } else {
        const amount = data.amount / 100;
        await base44.entities.Subscription.create({
          user_id: userId,
          plan: 'premium',
          status: 'active',
          billing_cycle: 'monthly',
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

      await base44.entities.User.update(userId, {
        subscription_tier: 'premium',
        subscription_status: 'active',
        subscription_expiry: periodEnd.toISOString(),
      });

      console.log(`Premium activated/extended for user ${userId} (ref ${reference})`);
      return Response.json({ received: true });
    }

    // ---- subscription.create ----
    if (eventType === 'subscription.create') {
      const subInfo = extractSubscriptionInfo(data);
      if (!subInfo?.subscription_code) return Response.json({ received: true });

      // Try to find the user and backfill the subscription code.
      const email = data.customer?.email;
      if (email) {
        try {
          const users = await base44.entities.User.filter({ email });
          if (users.length > 0) {
            const userId = users[0].id;
            const subs = await base44.entities.Subscription.filter(
              { user_id: userId, plan: 'premium', payment_provider: 'paystack' },
              '-created_date',
              10
            );
            if (subs.length > 0 && !subs[0].paystack_subscription_code) {
              await base44.entities.Subscription.update(subs[0].id, {
                paystack_subscription_code: subInfo.subscription_code,
                paystack_email_token: subInfo.email_token || subs[0].paystack_email_token || null,
              });
            }
          }
        } catch (e) { /* ignore */ }
      }

      return Response.json({ received: true });
    }

    // ---- subscription.disable ----
    if (eventType === 'subscription.disable') {
      const subInfo = extractSubscriptionInfo(data);
      if (!subInfo?.subscription_code) return Response.json({ received: true });

      const subs = await base44.entities.Subscription.filter({ paystack_subscription_code: subInfo.subscription_code });
      if (subs.length > 0) {
        await base44.entities.Subscription.update(subs[0].id, {
          status: 'cancelled',
          auto_renew: false,
        });
        console.log(`Subscription ${subInfo.subscription_code} cancelled for user ${subs[0].user_id}`);
      }

      return Response.json({ received: true });
    }

    // ---- charge.failed / invoice.payment_failed (recurring) ----
    if (eventType === 'charge.failed' || eventType === 'invoice.payment_failed') {
      const userId = await resolveUserId(base44, data, metadata);
      if (!userId) {
        console.error(`${eventType}: could not resolve user`);
        return Response.json({ received: true });
      }

      const subs = await base44.entities.Subscription.filter(
        { user_id: userId, plan: 'premium', payment_provider: 'paystack' },
        '-created_date',
        10
      );
      const activeSub = subs.find((s) => ['active', 'past_due', 'trialing'].includes(s.status));

      if (activeSub) {
        const graceUntil = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
        await base44.entities.Subscription.update(activeSub.id, {
          status: 'past_due',
          grace_until: graceUntil.toISOString(),
        });
        console.log(`Subscription past_due for user ${userId}, grace until ${graceUntil.toISOString()}`);
      }

      return Response.json({ received: true });
    }

    // Unknown event — acknowledge.
    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}