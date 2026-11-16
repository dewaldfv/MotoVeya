import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { PLAN_LABELS, PLAN_RANK, planIncludes } from '../../shared/planEntitlements.ts';

/** Server-authoritative subscription entitlement. Never trust a client-supplied premium flag. */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const now = new Date();
    const subs = await svc.entities.Subscription.filter({ user_id: me.id }, '-created_date', 50);

    // A subscription still inside its paid period counts, including a cancelled
    // one until it lapses, and a past-due one inside its grace window.
    const isUsable = (s) => {
      if (s.status === 'active' || s.status === 'trialing') return !s.expiry_date || new Date(s.expiry_date) > now;
      if (s.status === 'past_due') return !!s.grace_until && new Date(s.grace_until) > now;
      if (s.status === 'cancelled') return !!s.expiry_date && new Date(s.expiry_date) > now;
      return false;
    };

    const ended = (s) => {
      if (s.status === 'expired') return false;
      if (s.expiry_date && new Date(s.expiry_date) <= now) return true;
      return s.status === 'past_due' && (!s.grace_until || new Date(s.grace_until) <= now);
    };

    const entitlements = { rider: null, provider: null, organizer: null };
    const activePlans = [];

    for (const s of subs) {
      if (!s.plan || s.plan === 'free') continue;
      if (!isUsable(s)) {
        // Lapsed — close it out so the stored record matches the rider's access.
        if (ended(s)) await svc.entities.Subscription.update(s.id, { status: 'expired' }).catch(() => {});
        continue;
      }
      activePlans.push(s.plan);
      const includes = planIncludes(s.plan);
      if (includes.rider && !entitlements.rider) entitlements.rider = s;
      if (includes.provider && !entitlements.provider) entitlements.provider = s;
      if (includes.organizer && !entitlements.organizer) entitlements.organizer = s;
    }

    const plan = PLAN_RANK.find((id) => activePlans.includes(id)) || 'free';
    const primary = entitlements.rider || entitlements.provider || entitlements.organizer;

    // ---- Rider (premium) entitlement ----
    if (entitlements.rider) {
      const expiry = entitlements.rider.expiry_date || null;
      if (me.subscription_tier !== 'premium' || me.subscription_expiry !== expiry) {
        await svc.entities.User.update(me.id, {
          subscription_tier: 'premium',
          subscription_status: entitlements.rider.status === 'cancelled' ? 'cancelled' : 'active',
          subscription_expiry: expiry,
        }).catch(() => {});
      }
    } else if (me.subscription_tier === 'premium') {
      await svc.entities.User.update(me.id, {
        subscription_tier: 'free',
        subscription_status: 'expired',
      }).catch(() => {});
    }

    // ---- Service Provider entitlement ----
    // An admin-granted provider keeps access regardless of subscriptions.
    const adminGranted = me.provider_grant === 'admin';
    const providerSub = entitlements.provider;

    if (adminGranted) {
      if (me.account_type !== 'provider' || me.provider_status !== 'active') {
        await svc.entities.User.update(me.id, {
          account_type: 'provider',
          provider_status: 'active',
        }).catch(() => {});
      }
    } else if (providerSub) {
      const status = providerSub.status === 'cancelled' ? 'cancelled' : 'active';
      if (me.account_type !== 'provider' || me.provider_status !== status) {
        await svc.entities.User.update(me.id, {
          account_type: 'provider',
          provider_status: status,
          provider_expiry: providerSub.expiry_date || null,
        }).catch(() => {});
      }
    } else if (me.account_type === 'provider') {
      await svc.entities.User.update(me.id, {
        account_type: 'rider',
        provider_status: 'expired',
        provider_expiry: null,
      }).catch(() => {});
    }

    // ---- Organizer entitlement ----
    if (entitlements.organizer) {
      const status = entitlements.organizer.status === 'cancelled' ? 'cancelled' : 'active';
      const expiry = entitlements.organizer.expiry_date || null;
      if (me.organizer_status !== status || me.organizer_expiry !== expiry) {
        await svc.entities.User.update(me.id, {
          organizer_status: status,
          organizer_expiry: expiry,
        }).catch(() => {});
      }
    } else if (me.organizer_status === 'active' || me.organizer_status === 'cancelled') {
      await svc.entities.User.update(me.id, {
        organizer_status: 'expired',
      }).catch(() => {});
    }

    return Response.json({
      is_premium: !!entitlements.rider,
      is_provider: !!providerSub || adminGranted,
      is_organizer: !!entitlements.organizer,
      plan,
      plan_label: PLAN_LABELS[plan] || 'Free',
      status: primary?.status || 'none',
      expiry_date: primary?.expiry_date || null,
      grace_until: primary?.grace_until || null,
      billing_cycle: primary?.billing_cycle || null,
      auto_renew: primary?.auto_renew ?? null,
      provider_expiry: providerSub?.expiry_date || null,
      organizer_expiry: entitlements.organizer?.expiry_date || null,
    });
  } catch (error) {
    console.error('get-current-entitlement error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}