export const PRICING = {
  free: { label: 'Free', monthly: 0, annual: 0 },
  premium: { label: 'Premium', monthly: 69, annual: 690 },
};

export const PREMIUM_FEATURES = [
  { icon: 'Navigation', label: 'GPS Navigation', free: 'Basic', premium: 'Unlimited' },
  { icon: 'Shield', label: 'Crash Detection', free: true, premium: true },
  { icon: 'Phone', label: 'Emergency Contact Notification', free: '1 contact', premium: 'Automatic services' },
  { icon: 'Users', label: 'Group Size', free: '2 riders', premium: '32 riders' },
  { icon: 'Calendar', label: 'Motorcycle Events', free: 'View', premium: 'View + Discounts' },
  { icon: 'Fuel', label: 'Fuel Calculator', free: true, premium: true },
  { icon: 'MapPin', label: 'Restaurant & Fuel Suggestions', free: true, premium: true },
  { icon: 'Siren', label: 'Rider in Distress Alerts', free: false, premium: true },
  { icon: 'Ambulance', label: 'Auto Emergency Services', free: false, premium: true },
  { icon: 'UserPlus', label: 'Friends List', free: false, premium: true },
  { icon: 'Radar', label: 'Live Rider Tracking', free: false, premium: true },
  { icon: 'Route', label: 'Premium Route Planning', free: false, premium: true },
  { icon: 'BarChart3', label: 'Ride History & Statistics', free: false, premium: true },
];

export function isPremiumUser(user) {
  if (!user || user.subscription_tier !== 'premium') return false;
  if (user.subscription_expiry) {
    const expiry = new Date(user.subscription_expiry);
    if (expiry < new Date()) return false;
  }
  return true;
}

export function requiresPremium(feature, user) {
  const premiumFeatures = [
    'distress_alerts', 'auto_emergency', 'friends', 'live_tracking',
    'premium_routing', 'ride_stats', 'large_groups', 'event_discounts',
  ];
  if (!premiumFeatures.includes(feature)) return false;
  return !isPremiumUser(user);
}