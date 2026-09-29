export default async function(req) {
  return Response.json({ error: 'Premium trials are no longer available. Premium is R89.99 per month.' }, { status: 410 });
  /*
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const existing = await svc.entities.Subscription.filter({ user_id: me.id }, '-created_date', 100);
    const alreadyUsed = (existing || []).some((s) => s.payment_provider === 'trial' || s.status === 'trialing');
    if (alreadyUsed) return Response.json({ error: 'Premium trial already used' }, { status: 409 });

    const now = new Date();
    const expiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const subscription = await svc.entities.Subscription.create({
      user_id: me.id,
      plan: 'premium',
      status: 'trialing',
      billing_cycle: 'monthly',
      amount_zar: 0,
      purchase_date: now.toISOString(),
      renewal_date: expiry.toISOString(),
      expiry_date: expiry.toISOString(),
      payment_provider: 'trial',
      auto_renew: false,
    });
    await svc.entities.User.update(me.id, {
      subscription_tier: 'premium',
      subscription_status: 'trialing',
      subscription_expiry: expiry.toISOString(),
    });

    return Response.json({ active: true, expiry_date: expiry.toISOString(), subscription_id: subscription.id });
  } catch (error) {
    console.error('start-premium-trial error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
  */
}
