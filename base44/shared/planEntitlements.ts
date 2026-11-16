/**
 * The MotoVeya plan catalogue on the server side. Amounts are in cents and must
 * match the prices the pricing screens show (src/lib/plans.js).
 */
export const PLAN_AMOUNTS = {
  premium: 6999,
  provider: 2999,
  provider_plus: 7999,
  organizer: 2999,
  organizer_plus: 7999,
  gold: 8999,
};

/**
 * The Paystack plans the user created for MotoVeya. Checkout charges these
 * directly, so the amount billed always matches the plan's own price.
 */
export const PLAN_CODES = {
  premium: 'PLN_szhwrzfq4viebfi',
  provider: 'PLN_yvcyl1wl9a64tow',
  provider_plus: 'PLN_j3eiq83khle4o7x',
  organizer: 'PLN_tb6p9kvif0aqiet',
  organizer_plus: 'PLN_vl9sgs0r8uh8pf9',
  gold: 'PLN_t8ydrmdpvcw2dp4',
};

export function planForCode(code: any) {
  if (typeof code !== 'string') return null;
  return Object.keys(PLAN_CODES).find((plan) => PLAN_CODES[plan] === code) || null;
}

export const PLAN_LABELS = {
  premium: 'Premium',
  provider: 'Service Provider',
  provider_plus: 'Provider+',
  organizer: 'Organizer',
  organizer_plus: 'Organizer+',
  gold: 'Gold',
};

export const PLAN_INCLUDES = {
  premium: { rider: true, provider: false, organizer: false },
  provider: { rider: false, provider: true, organizer: false },
  provider_plus: { rider: true, provider: true, organizer: false },
  organizer: { rider: false, provider: false, organizer: true },
  organizer_plus: { rider: true, provider: false, organizer: true },
  gold: { rider: true, provider: true, organizer: true },
};

// Most complete plan first — used to resolve which plan a user is effectively on
// when several subscriptions are still inside their paid period.
export const PLAN_RANK = ['gold', 'provider_plus', 'organizer_plus', 'premium', 'provider', 'organizer'];

export function isKnownPlan(plan: any): boolean {
  return typeof plan === 'string' && Object.prototype.hasOwnProperty.call(PLAN_AMOUNTS, plan);
}

export function planIncludes(plan: any) {
  return PLAN_INCLUDES[plan] || { rider: false, provider: false, organizer: false };
}

export function planForAmount(amount: any) {
  const value = Number(amount);
  return PLAN_RANK.find((plan) => PLAN_AMOUNTS[plan] === value && plan !== 'organizer') || null;
}

/** Writes the entitlements a paid plan unlocks onto the user record. */
export async function applyPlanEntitlements(svc: any, userId: string, plan: string, periodEnd: Date) {
  const includes = planIncludes(plan);
  const iso = periodEnd.toISOString();
  const updates: Record<string, any> = {};

  if (includes.rider) {
    updates.subscription_tier = 'premium';
    updates.subscription_status = 'active';
    updates.subscription_expiry = iso;
  }
  if (includes.provider) {
    updates.account_type = 'provider';
    updates.provider_status = 'active';
    updates.provider_expiry = iso;
  }
  if (includes.organizer) {
    updates.organizer_status = 'active';
    updates.organizer_expiry = iso;
  }

  if (Object.keys(updates).length > 0) {
    await svc.entities.User.update(userId, updates);
  }
}