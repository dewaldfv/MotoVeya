/**
 * Server-authoritative subscription entitlement resolver.
 * Shared by get-current-entitlement and saved-place-geofence so the
 * Free/Premium cap always reflects the authoritative Subscription state.
 */
export async function resolveEntitlement(svc: any, userId: string) {
  const now = new Date();
  let subs: any[] = [];
  try {
    subs = await svc.entities.Subscription.filter({ user_id: userId }, '-created_date', 50);
  } catch (e) {
    return { is_premium: false };
  }
  for (const s of subs) {
    if (s.plan !== 'premium') continue;
    if (s.status === 'active' || s.status === 'trialing') {
      if (!s.expiry_date || new Date(s.expiry_date) > now) return { is_premium: true, subscription: s };
    } else if (s.status === 'past_due') {
      if (s.grace_until && new Date(s.grace_until) > now) return { is_premium: true, subscription: s };
    } else if (s.status === 'cancelled') {
      if (s.expiry_date && new Date(s.expiry_date) > now) return { is_premium: true, subscription: s };
    }
  }
  return { is_premium: false };
}