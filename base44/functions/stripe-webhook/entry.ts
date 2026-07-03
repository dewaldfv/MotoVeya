import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function verifyStripeSignature(body, signatureHeader, secret) {
  const parts = signatureHeader.split(',');
  const timestamp = parts.find((p) => p.startsWith('t='))?.split('=')[1];
  const signature = parts.find((p) => p.startsWith('v1='))?.split('=')[1];
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expectedSig = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expectedHex = Array.from(new Uint8Array(expectedSig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return expectedHex === signature;
}

async function retrieveSubscription(subscriptionId) {
  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` },
  });
  return response.json();
}

Deno.serve(async (req) => {
  try {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!sig || !webhookSecret) {
      return Response.json({ error: 'Missing signature or secret' }, { status: 400 });
    }

    const isValid = await verifyStripeSignature(body, sig, webhookSecret);
    if (!isValid) {
      console.error('Stripe webhook signature verification failed');
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);
    const base44 = createClientFromRequest(req).asServiceRole;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const cycle = session.metadata?.billing_cycle || 'monthly';
        const subscriptionId = session.subscription;
        const subscription = await retrieveSubscription(subscriptionId);
        const periodEnd = new Date(subscription.current_period_end * 1000);
        const periodStart = new Date(subscription.current_period_start * 1000);

        await base44.entities.Subscription.create({
          user_id: userId,
          plan: 'premium',
          status: 'active',
          billing_cycle: cycle,
          amount_zar: cycle === 'annual' ? 799.99 : 79.99,
          purchase_date: periodStart.toISOString(),
          renewal_date: periodEnd.toISOString(),
          expiry_date: periodEnd.toISOString(),
          purchase_token: subscriptionId,
          payment_provider: 'stripe',
          auto_renew: !subscription.cancel_at_period_end,
        });

        if (userId) {
          await base44.entities.User.update(userId, {
            subscription_tier: 'premium',
            subscription_status: 'active',
            subscription_expiry: periodEnd.toISOString(),
          });
        }
        console.log(`Premium activated for user ${userId}`);
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object;
        if (invoice.billing_reason === 'subscription_cycle') {
          const subscriptionId = invoice.subscription;
          const subscription = await retrieveSubscription(subscriptionId);
          const periodEnd = new Date(subscription.current_period_end * 1000);
          const subs = await base44.entities.Subscription.filter({ purchase_token: subscriptionId });
          if (subs.length > 0) {
            await base44.entities.Subscription.update(subs[0].id, {
              status: 'active',
              renewal_date: periodEnd.toISOString(),
              expiry_date: periodEnd.toISOString(),
            });
          }
          const userId = subscription.metadata?.user_id;
          if (userId) {
            await base44.entities.User.update(userId, {
              subscription_tier: 'premium',
              subscription_status: 'active',
              subscription_expiry: periodEnd.toISOString(),
            });
          }
          console.log(`Subscription renewed for user ${userId}`);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;
        const periodEnd = new Date(subscription.current_period_end * 1000);
        const subs = await base44.entities.Subscription.filter({ purchase_token: subscriptionId });
        if (subs.length > 0) {
          const status = subscription.status === 'active' ? 'active' : subscription.status === 'canceled' ? 'cancelled' : 'active';
          await base44.entities.Subscription.update(subs[0].id, {
            status,
            renewal_date: periodEnd.toISOString(),
            expiry_date: periodEnd.toISOString(),
            auto_renew: !subscription.cancel_at_period_end,
          });
        }
        const userId = subscription.metadata?.user_id;
        if (userId) {
          const isPremium = subscription.status === 'active';
          await base44.entities.User.update(userId, {
            subscription_tier: isPremium ? 'premium' : 'free',
            subscription_status: subscription.status === 'active' ? 'active' : 'expired',
            ...(isPremium ? { subscription_expiry: periodEnd.toISOString() } : {}),
          });
        }
        console.log(`Subscription updated for user ${userId}: ${subscription.status}`);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;
        const subs = await base44.entities.Subscription.filter({ purchase_token: subscriptionId });
        if (subs.length > 0) {
          await base44.entities.Subscription.update(subs[0].id, { status: 'expired', auto_renew: false });
        }
        const userId = subscription.metadata?.user_id;
        if (userId) {
          await base44.entities.User.update(userId, {
            subscription_tier: 'free',
            subscription_status: 'expired',
          });
        }
        console.log(`Subscription expired for user ${userId}`);
        break;
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});