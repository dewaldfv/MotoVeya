import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

/** Server-authoritative subscription entitlement. Never trust a client-supplied premium flag. */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const now = new Date();
    const subs = await svc.entities.Subscription.filter({ user_id: me.id }, '-created_date', 50);

    let valid = null;
    for (const s of subs) {
      if (s.plan !== 'premium') continue;

      if (s.status === 'active' || s.status === 'trialing') {
        if (!s.expiry_date || new Date(s.expiry_date) > now) {
          valid = s;
          break;
        }
      } else if (s.status === 'past_due') {
        // Premium stays valid during the grace window.
        if (s.grace_until && new Date(s.grace_until) > now) {
          valid = s;
          break;
        }
        // Grace expired — lazily revoke.
        if (!s.grace_until || new Date(s.grace_until) <= now) {
          await svc.entities.Subscription.update(s.id, { status: 'expired' }).catch(() => {});
          await svc.entities.User.update(me.id, {
            subscription_tier: 'free',
            subscription_status: 'expired',
          }).catch(() => {});
        }
      } else if (s.status === 'cancelled') {
        // Cancelled but still within the paid period.
        if (s.expiry_date && new Date(s.expiry_date) > now) {
          valid = s;
          break;
        }
        // Period ended — close it out so the rider's tier matches their entitlement.
        if (s.expiry_date && new Date(s.expiry_date) <= now) {
          await svc.entities.Subscription.update(s.id, { status: 'expired' }).catch(() => {});
          await svc.entities.User.update(me.id, {
            subscription_tier: 'free',
            subscription_status: 'expired',
          }).catch(() => {});
        }
      }
    }

    // ---- Service Provider package entitlement ----
    let providerSub = null;
    for (const s of subs) {
      if (s.plan !== 'provider') continue;
      if (!['active', 'trialing', 'cancelled', 'past_due'].includes(s.status)) continue;
      if (s.expiry_date && new Date(s.expiry_date) <= now) {
        await svc.entities.Subscription.update(s.id, { status: 'expired' }).catch(() => {});
        continue;
      }
      providerSub = s;
      break;
    }

    const providerEnded = me.account_type === 'provider' && !providerSub;
    if (providerSub && (me.account_type !== 'provider' || me.provider_status !== 'active')) {
      await svc.entities.User.update(me.id, {
        account_type: 'provider',
        provider_status: providerSub.status === 'cancelled' ? 'cancelled' : 'active',
        provider_expiry: providerSub.expiry_date || null,
      }).catch(() => {});
    } else if (providerEnded) {
      await svc.entities.User.update(me.id, {
        account_type: 'rider',
        provider_status: 'expired',
        provider_expiry: null,
      }).catch(() => {});
    }

    return Response.json({
      is_premium: !!valid,
      is_provider: !!providerSub,
      provider_expiry: providerSub?.expiry_date || null,
      plan: valid?.plan || 'free',
      status: valid?.status || 'none',
      expiry_date: valid?.expiry_date || null,
      grace_until: valid?.grace_until || null,
      billing_cycle: valid?.billing_cycle || null,
      auto_renew: valid?.auto_renew ?? null,
    });
  } catch (error) {
    console.error('get-current-entitlement error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}