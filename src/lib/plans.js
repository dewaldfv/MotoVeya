/**
 * The MotoVeya plan catalogue. One source of truth for the prices and features
 * every pricing screen shows; the backend mirrors these amounts when it creates
 * the Paystack checkout and verifies the payment.
 */
export const PLANS = [
  {
    id: 'premium',
    label: 'Premium',
    description: 'All premium Rider features unlocked.',
    monthly: 69.99,
    includes: ['rider'],
  },
  {
    id: 'provider',
    label: 'Service Provider',
    description: 'All Service Provider features unlocked.',
    monthly: 29.99,
    includes: ['provider'],
  },
  {
    id: 'provider_plus',
    label: 'Provider+',
    description: 'All Service Provider functions and Premium Rider features unlocked.',
    monthly: 79.99,
    includes: ['provider', 'rider'],
  },
  {
    id: 'organizer',
    label: 'Organizer',
    description: 'All Organizer features unlocked.',
    monthly: 29.99,
    includes: ['organizer'],
  },
  {
    id: 'organizer_plus',
    label: 'Organizer+',
    description: 'All Organizer and Premium Rider features unlocked.',
    monthly: 79.99,
    includes: ['organizer', 'rider'],
  },
  {
    id: 'gold',
    label: 'Gold',
    description: 'All Premium Rider, Provider and Organizer features unlocked.',
    monthly: 89.99,
    includes: ['rider', 'provider', 'organizer'],
  },
];

export const PLANS_BY_ID = PLANS.reduce((acc, plan) => ({ ...acc, [plan.id]: plan }), {});

export const planLabel = (planId) => PLANS_BY_ID[planId]?.label || 'Free';

export const PRICING = {
  free: { label: 'Free', monthly: 0, annual: 0 },
  premium: { label: 'Premium', monthly: PLANS_BY_ID.premium.monthly, annual: 0 },
};

export const PREMIUM_FEATURES = [
  { icon: 'Navigation', label: 'GPS Navigation', free: 'Basic', premium: 'Unlimited' },
  { icon: 'Shield', label: 'Crash Detection', free: true, premium: true },
  { icon: 'Phone', label: 'Emergency Contact Notification', free: '1 contact', premium: 'Enhanced alerts' },
  { icon: 'Users', label: 'Group Size', free: '2 riders', premium: '32 riders' },
  { icon: 'Calendar', label: 'Motorcycle Events', free: 'View', premium: 'View + Discounts' },
  { icon: 'Fuel', label: 'Fuel Calculator', free: true, premium: true },
  { icon: 'MapPin', label: 'Restaurant & Fuel Suggestions', free: true, premium: true },
  { icon: 'Siren', label: 'Universal Rider Down Alerts', free: true, premium: true },
  { icon: 'Ambulance', label: '20 km Rider Down Coverage', free: true, premium: true },
  { icon: 'UserPlus', label: 'Friends List', free: false, premium: true },
  { icon: 'Radar', label: 'Live Rider Tracking', free: false, premium: true },
  { icon: 'Route', label: 'Premium Route Planning', free: false, premium: true },
  { icon: 'BarChart3', label: 'Ride History & Statistics', free: false, premium: true },
];

export const PROVIDER_PLAN = {
  label: 'Service Provider',
  monthly: PLANS_BY_ID.provider.monthly,
  slots: 10,
};

export const PROVIDER_PERKS = [
  `Up to ${PROVIDER_PLAN.slots} service or venue listings`,
  'Create and edit your own listings',
  'Track views on every listing you own',
  'Appear on the rider map and service directory',
];

export const PROVIDER_EXCLUDES = [
  'Ride mode and the Rides tab',
  'Community: Groups, Friends and Food pages',
  'Profile: Achievements, Emergency and Safety',
];

export function isAdminUser(user) {
  return user?.role === 'admin' || user?.role === 'moderator';
}

/** True while the Service Provider access is paid up, or an admin granted it. */
export function isServiceProvider(user) {
  if (!user) return false;
  // Manual admin grant — independent of any paid package.
  if (user.provider_grant === 'admin') return true;
  if (user.account_type !== 'provider') return false;
  if (user.provider_status === 'expired' || user.provider_status === 'none') return false;
  if (user.provider_expiry) {
    const expiry = new Date(user.provider_expiry);
    if (expiry < new Date()) return false;
  }
  return true;
}

/** True while the Organizer access is paid up (Organizer, Organizer+ or Gold). */
export function isOrganizer(user) {
  if (!user) return false;
  if (user.organizer_status !== 'active' && user.organizer_status !== 'cancelled') return false;
  if (user.organizer_expiry && new Date(user.organizer_expiry) < new Date()) return false;
  return true;
}

/** Only providers and admins may add or edit service listings. */
export function canManageServices(user) {
  return isAdminUser(user) || isServiceProvider(user);
}

/** Organizers (and premium riders) may submit events. */
export function canCreateEvents(user) {
  return isAdminUser(user) || isPremiumUser(user) || isOrganizer(user);
}

export function isPremiumUser(user) {
  if (!user || user.subscription_tier !== 'premium') return false;
  if (user.subscription_expiry) {
    const expiry = new Date(user.subscription_expiry);
    if (expiry < new Date()) return false;
  }
  return true;
}

/**
 * Accounts whose only paid access is the Service Provider package. Those accounts
 * keep the rider features out of reach; Provider+, Organizer+ and Gold also carry
 * rider access, so they are never treated as provider-only.
 */
export function isProviderOnlyAccount(user) {
  if (isAdminUser(user)) return false;
  return isServiceProvider(user) && !isPremiumUser(user);
}

export function requiresPremium(feature, user) {
  const premiumFeatures = [
    'friends', 'live_tracking',
    'premium_routing', 'ride_stats', 'large_groups', 'event_discounts',
  ];
  if (!premiumFeatures.includes(feature)) return false;
  return !isPremiumUser(user);
}