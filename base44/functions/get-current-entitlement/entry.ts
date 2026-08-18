import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/** Server-authoritative subscription entitlement. Never trust a client-supplied premium flag. */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const now = new Date();
    const subs = await svc.entities.Subscription.filter({ user_id: me.id }, '-created_date', 50);
    const valid = (subs || []).find((s) => {
      if (s.plan !== 'premium') return false;
      if (!['active', 'trialing'].includes(s.status)) return false;
      if (!s.expiry_date) return true;
      return new Date(s.expiry_date) > now;
    });

    return Response.json({
      is_premium: !!valid,
      plan: valid?.plan || 'free',
      status: valid?.status || 'none',
      expiry_date: valid?.expiry_date || null,
      billing_cycle: valid?.billing_cycle || null,
    });
  } catch (error) {
    console.error('get-current-entitlement error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
