// Achievement catalog + progress evaluation for MotoGo rider profiles.
// Each achievement is tied to a metric we compute from the user's data.

export const ACHIEVEMENT_CATALOG = [
  // Ride count milestones
  { id: 'first_ride', emoji: '🏍️', name: 'First Ride', description: 'Complete your very first ride', metric: 'rides', threshold: 1 },
  { id: 'getting_started', emoji: '🌱', name: 'Getting Started', description: 'Complete 5 rides', metric: 'rides', threshold: 5 },
  { id: 'weekly_warrior', emoji: '⚔️', name: 'Weekly Warrior', description: 'Complete 10 rides', metric: 'rides', threshold: 10 },
  { id: 'dedicated_rider', emoji: '💪', name: 'Dedicated Rider', description: 'Complete 25 rides', metric: 'rides', threshold: 25 },
  { id: 'seasoned_rider', emoji: '⭐', name: 'Seasoned Rider', description: 'Complete 50 rides', metric: 'rides', threshold: 50 },
  { id: 'century_club', emoji: '🎟️', name: 'Century Club', description: 'Complete 100 rides', metric: 'rides', threshold: 100 },

  // Distance milestones (km)
  { id: 'century_rider', emoji: '💯', name: 'Century Rider', description: 'Ride 100 km in total', metric: 'distance', threshold: 100, unit: 'km' },
  { id: 'long_hauler', emoji: '🛣️', name: 'Long Hauler', description: 'Ride 500 km in total', metric: 'distance', threshold: 500, unit: 'km' },
  { id: 'kilometer_king', emoji: '🏆', name: 'Kilometer King', description: 'Ride 1 000 km in total', metric: 'distance', threshold: 1000, unit: 'km' },
  { id: 'iron_rider', emoji: '🛡️', name: 'Iron Rider', description: 'Ride 5 000 km in total', metric: 'distance', threshold: 5000, unit: 'km' },

  // Speed milestones (km/h)
  { id: 'speed_demon', emoji: '⚡', name: 'Speed Demon', description: 'Hit a top speed of 120 km/h', metric: 'maxSpeed', threshold: 120, unit: 'km/h' },
  { id: 'adrenaline_rush', emoji: '🔥', name: 'Adrenaline Rush', description: 'Hit a top speed of 160 km/h', metric: 'maxSpeed', threshold: 160, unit: 'km/h' },
  { id: 'warp_speed', emoji: '🚀', name: 'Warp Speed', description: 'Hit a top speed of 200 km/h', metric: 'maxSpeed', threshold: 200, unit: 'km/h' },

  // Fuel logging
  { id: 'first_refill', emoji: '⛽', name: 'First Refill', description: 'Log your first fuel refill', metric: 'refills', threshold: 1 },
  { id: 'fuel_conscious', emoji: '🧮', name: 'Fuel Conscious', description: 'Log 10 fuel refills', metric: 'refills', threshold: 10 },

  // Social
  { id: 'first_friend', emoji: '🤝', name: 'First Friend', description: 'Add your first MotoGo friend', metric: 'friends', threshold: 1 },
  { id: 'social_butterfly', emoji: '🦋', name: 'Social Butterfly', description: 'Add 10 friends', metric: 'friends', threshold: 10 },
  { id: 'group_member', emoji: '👥', name: 'Group Member', description: 'Join a riding group', metric: 'groups', threshold: 1 },

  // Safety
  { id: 'guardian', emoji: '🛟', name: 'Guardian', description: 'Set an emergency contact', metric: 'emergencyContacts', threshold: 1 },
];

export function getMetricValue(stats, metric) {
  switch (metric) {
    case 'rides': return stats.totalRides || 0;
    case 'distance': return stats.totalDistance || 0;
    case 'maxSpeed': return stats.maxSpeed || 0;
    case 'refills': return stats.refills || 0;
    case 'friends': return stats.friends || 0;
    case 'groups': return stats.groups || 0;
    case 'emergencyContacts': return stats.emergencyContacts || 0;
    default: return 0;
  }
}

export function evaluateAchievements(stats) {
  const collected = [];
  const inProgress = [];
  const locked = [];

  for (const a of ACHIEVEMENT_CATALOG) {
    const current = getMetricValue(stats, a.metric);
    const progress = Math.min(1, a.threshold > 0 ? current / a.threshold : 0);
    const item = { ...a, current, progress };
    if (current >= a.threshold) collected.push(item);
    else if (current > 0) inProgress.push(item);
    else locked.push(item);
  }

  return { collected, inProgress, locked };
}