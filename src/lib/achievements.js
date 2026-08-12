// Achievement catalog + progress evaluation for MotoVeya rider profiles.
// 100 achievements across riding, distance, speed, endurance, fuel, garage,
// planning, social, group rides, safety, time-of-day and consistency.

export const ACHIEVEMENT_CATALOG = [
  // === Ride count milestones (8) ===
  { id: 'first_ride', emoji: '🏍️', name: 'First Ride', description: 'Complete your very first ride', metric: 'rides', threshold: 1 },
  { id: 'getting_started', emoji: '🌱', name: 'Getting Started', description: 'Complete 5 rides', metric: 'rides', threshold: 5 },
  { id: 'weekly_warrior', emoji: '⚔️', name: 'Weekly Warrior', description: 'Complete 10 rides', metric: 'rides', threshold: 10 },
  { id: 'dedicated_rider', emoji: '💪', name: 'Dedicated Rider', description: 'Complete 25 rides', metric: 'rides', threshold: 25 },
  { id: 'seasoned_rider', emoji: '⭐', name: 'Seasoned Rider', description: 'Complete 50 rides', metric: 'rides', threshold: 50 },
  { id: 'century_club', emoji: '🎟️', name: 'Century Club', description: 'Complete 100 rides', metric: 'rides', threshold: 100 },
  { id: 'ride_veteran', emoji: '🎖️', name: 'Ride Veteran', description: 'Complete 250 rides', metric: 'rides', threshold: 250 },
  { id: 'ride_legend', emoji: '🏅', name: 'Ride Legend', description: 'Complete 500 rides', metric: 'rides', threshold: 500 },

  // === Total distance (8) ===
  { id: 'century_rider', emoji: '💯', name: 'Century Rider', description: 'Ride 100 km in total', metric: 'distance', threshold: 100, unit: 'km' },
  { id: 'long_hauler', emoji: '🛣️', name: 'Long Hauler', description: 'Ride 500 km in total', metric: 'distance', threshold: 500, unit: 'km' },
  { id: 'kilometer_king', emoji: '🏆', name: 'Kilometer King', description: 'Ride 1 000 km in total', metric: 'distance', threshold: 1000, unit: 'km' },
  { id: 'iron_rider', emoji: '🛡️', name: 'Iron Rider', description: 'Ride 5 000 km in total', metric: 'distance', threshold: 5000, unit: 'km' },
  { id: 'continental', emoji: '🌍', name: 'The Continental', description: 'Ride 10 000 km in total', metric: 'distance', threshold: 10000, unit: 'km' },
  { id: 'cape_cruiser', emoji: '🗺️', name: 'Cape Cruiser', description: 'Ride 15 000 km in total', metric: 'distance', threshold: 15000, unit: 'km' },
  { id: 'highway_star', emoji: '✨', name: 'Highway Star', description: 'Ride 25 000 km in total', metric: 'distance', threshold: 25000, unit: 'km' },
  { id: 'distance_legend', emoji: '👑', name: 'Distance Legend', description: 'Ride 50 000 km in total', metric: 'distance', threshold: 50000, unit: 'km' },

  // === Top speed (5) ===
  { id: 'speed_demon', emoji: '⚡', name: 'Speed Demon', description: 'Hit a top speed of 120 km/h', metric: 'maxSpeed', threshold: 120, unit: 'km/h' },
  { id: 'adrenaline_rush', emoji: '🔥', name: 'Adrenaline Rush', description: 'Hit a top speed of 160 km/h', metric: 'maxSpeed', threshold: 160, unit: 'km/h' },
  { id: 'warp_speed', emoji: '🚀', name: 'Warp Speed', description: 'Hit a top speed of 200 km/h', metric: 'maxSpeed', threshold: 200, unit: 'km/h' },
  { id: 'mach_rider', emoji: '💨', name: 'Mach Rider', description: 'Hit a top speed of 240 km/h', metric: 'maxSpeed', threshold: 240, unit: 'km/h' },
  { id: 'sound_barrier', emoji: '🌬️', name: 'Sound Barrier', description: 'Hit a top speed of 280 km/h', metric: 'maxSpeed', threshold: 280, unit: 'km/h' },

  // === Single-ride endurance (6) ===
  { id: 'day_tripper', emoji: '🌤️', name: 'Day Tripper', description: 'Complete a single ride of 200 km', metric: 'longestRideKm', threshold: 200, unit: 'km' },
  { id: 'iron_butt_entry', emoji: '🥵', name: 'Iron Butt Entry', description: 'Complete a single ride of 500 km', metric: 'longestRideKm', threshold: 500, unit: 'km' },
  { id: 'saddle_sore', emoji: '🐴', name: 'Saddle Sore', description: 'Complete a single ride of 800 km', metric: 'longestRideKm', threshold: 800, unit: 'km' },
  { id: 'endurance_master', emoji: '🏔️', name: 'Endurance Master', description: 'Complete a single ride of 1 000 km', metric: 'longestRideKm', threshold: 1000, unit: 'km' },
  { id: 'road_warrior', emoji: '🛞', name: 'Road Warrior', description: 'Complete a single ride of 1 500 km', metric: 'longestRideKm', threshold: 1500, unit: 'km' },
  { id: 'marathon_rider', emoji: '🏃', name: 'Marathon Rider', description: 'Complete a single ride of 2 000 km', metric: 'longestRideKm', threshold: 2000, unit: 'km' },

  // === Fuel refill logging (6) ===
  { id: 'first_refill', emoji: '⛽', name: 'First Refill', description: 'Log your first fuel refill', metric: 'refills', threshold: 1 },
  { id: 'fuel_conscious', emoji: '🧮', name: 'Fuel Conscious', description: 'Log 10 fuel refills', metric: 'refills', threshold: 10 },
  { id: 'high_volume_logger', emoji: '📊', name: 'High-Volume Logger', description: 'Log 50 fuel refills', metric: 'refills', threshold: 50 },
  { id: 'fuel_archivist', emoji: '📚', name: 'Fuel Archivist', description: 'Log 100 fuel refills', metric: 'refills', threshold: 100 },
  { id: 'the_accountant', emoji: '🧾', name: 'The Accountant', description: 'Log 250 fuel refills', metric: 'refills', threshold: 250 },
  { id: 'fuel_historian', emoji: '🏛️', name: 'Fuel Historian', description: 'Log 500 fuel refills', metric: 'refills', threshold: 500 },

  // === Eco / efficiency refills (5) ===
  { id: 'eco_novice', emoji: '🍃', name: 'Eco Novice', description: 'Log 1 refill under 3.5 L/100km', metric: 'ecoRefills', threshold: 1 },
  { id: 'eco_rider', emoji: '🌿', name: 'Eco Rider', description: 'Log 5 efficient refills', metric: 'ecoRefills', threshold: 5 },
  { id: 'green_machine', emoji: '♻️', name: 'Green Machine', description: 'Log 15 efficient refills', metric: 'ecoRefills', threshold: 15 },
  { id: 'efficiency_master', emoji: '⚙️', name: 'Efficiency Master', description: 'Log 30 efficient refills', metric: 'ecoRefills', threshold: 30 },
  { id: 'eco_legend', emoji: '🌱', name: 'Eco Legend', description: 'Log 75 efficient refills', metric: 'ecoRefills', threshold: 75 },

  // === Full-tank refills (4) ===
  { id: 'fill_er_up', emoji: '🫙', name: "Fill 'Er Up", description: 'Log your first full-tank refill', metric: 'fullTankRefills', threshold: 1 },
  { id: 'full_tank_regular', emoji: '🔴', name: 'Full-Tank Regular', description: 'Log 10 full-tank refills', metric: 'fullTankRefills', threshold: 10 },
  { id: 'brim_specialist', emoji: '🪣', name: 'Brim Specialist', description: 'Log 50 full-tank refills', metric: 'fullTankRefills', threshold: 50 },
  { id: 'topup_pro', emoji: '📈', name: 'Top-Up Pro', description: 'Log 100 full-tank refills', metric: 'fullTankRefills', threshold: 100 },

  // === Service records (6) ===
  { id: 'grease_monkey', emoji: '🔧', name: 'Grease Monkey', description: 'Log your first service record', metric: 'services', threshold: 1 },
  { id: 'wrench_turner', emoji: '🛠️', name: 'Wrench Turner', description: 'Log 5 service records', metric: 'services', threshold: 5 },
  { id: 'oil_change_rookie', emoji: '🛢️', name: 'Oil Change Rookie', description: 'Log 10 service records', metric: 'services', threshold: 10 },
  { id: 'professional_mechanic', emoji: '🏭', name: 'Professional Mechanic', description: 'Log 25 service records', metric: 'services', threshold: 25 },
  { id: 'master_technician', emoji: '🧑‍🔧', name: 'Master Technician', description: 'Log 50 service records', metric: 'services', threshold: 50 },
  { id: 'service_sage', emoji: '📜', name: 'Service Sage', description: 'Log 100 service records', metric: 'services', threshold: 100 },

  // === Specialised services (4) ===
  { id: 'tire_whisperer', emoji: '🛞', name: 'Tire Whisperer', description: 'Log 3 tyre services', metric: 'tireServices', threshold: 3 },
  { id: 'tire_collector', emoji: '⚫', name: 'Tire Collector', description: 'Log 6 tyre services', metric: 'tireServices', threshold: 6 },
  { id: 'chain_keeper', emoji: '🔗', name: 'Chain Keeper', description: 'Log 5 chain & sprocket services', metric: 'chainServices', threshold: 5 },
  { id: 'brake_boss', emoji: '🛑', name: 'Brake Boss', description: 'Log 3 brake services', metric: 'brakeServices', threshold: 3 },

  // === Bike garage (5) ===
  { id: 'first_bike', emoji: '🏍️', name: 'First Bike', description: 'Add your first motorcycle', metric: 'bikes', threshold: 1 },
  { id: 'two_up', emoji: '👯', name: 'Two-Up', description: 'Own 2 motorcycles', metric: 'bikes', threshold: 2 },
  { id: 'the_collector', emoji: '🗃️', name: 'The Collector', description: 'Own 3 motorcycles', metric: 'bikes', threshold: 3 },
  { id: 'garage_master', emoji: '🏠', name: 'Garage Master', description: 'Own 5 motorcycles', metric: 'bikes', threshold: 5 },
  { id: 'motorcycle_mogul', emoji: '🏯', name: 'Motorcycle Mogul', description: 'Own 8 motorcycles', metric: 'bikes', threshold: 8 },

  // === Ride planner (5) ===
  { id: 'the_architect', emoji: '📐', name: 'The Architect', description: 'Save your first route', metric: 'ridePlans', threshold: 1 },
  { id: 'route_planner', emoji: '🗺️', name: 'Route Planner', description: 'Save 10 routes', metric: 'ridePlans', threshold: 10 },
  { id: 'waypoint_master', emoji: '📍', name: 'Waypoint Master', description: 'Save 25 routes', metric: 'ridePlans', threshold: 25 },
  { id: 'adventure_architect', emoji: '🧭', name: 'Adventure Architect', description: 'Save 50 routes', metric: 'ridePlans', threshold: 50 },
  { id: 'cartographer', emoji: '🌐', name: 'Cartographer', description: 'Save 100 routes', metric: 'ridePlans', threshold: 100 },

  // === Friends (6) ===
  { id: 'first_friend', emoji: '🤝', name: 'First Friend', description: 'Add your first MotoVeya friend', metric: 'friends', threshold: 1 },
  { id: 'friendly_rider', emoji: '😊', name: 'Friendly Rider', description: 'Add 10 friends', metric: 'friends', threshold: 10 },
  { id: 'social_butterfly', emoji: '🦋', name: 'Social Butterfly', description: 'Add 25 friends', metric: 'friends', threshold: 25 },
  { id: 'friendship_circle', emoji: '🔄', name: 'Friendship Circle', description: 'Add 50 friends', metric: 'friends', threshold: 50 },
  { id: 'network_builder', emoji: '📡', name: 'Network Builder', description: 'Add 100 friends', metric: 'friends', threshold: 100 },
  { id: 'motogo_celebrity', emoji: '🌟', name: 'MotoVeya Celebrity', description: 'Add 250 friends', metric: 'friends', threshold: 250 },

  // === Groups (5) ===
  { id: 'group_member', emoji: '👥', name: 'Group Member', description: 'Join a riding group', metric: 'groups', threshold: 1 },
  { id: 'groupie', emoji: '🎸', name: 'Groupie', description: 'Join 3 groups', metric: 'groups', threshold: 3 },
  { id: 'club_hopper', emoji: '🚌', name: 'Club Hopper', description: 'Join 5 groups', metric: 'groups', threshold: 5 },
  { id: 'community_pillar', emoji: '🏛️', name: 'Community Pillar', description: 'Join 10 groups', metric: 'groups', threshold: 10 },
  { id: 'social_hub', emoji: '🎯', name: 'Social Hub', description: 'Join 20 groups', metric: 'groups', threshold: 20 },

  // === Group rides led (5) ===
  { id: 'ride_leader', emoji: '🚩', name: 'Ride Leader', description: 'Lead your first group ride', metric: 'groupRidesLed', threshold: 1 },
  { id: 'pack_leader', emoji: '🐺', name: 'Pack Leader', description: 'Lead 5 group rides', metric: 'groupRidesLed', threshold: 5 },
  { id: 'the_captain', emoji: '⚓', name: 'The Captain', description: 'Lead 10 group rides', metric: 'groupRidesLed', threshold: 10 },
  { id: 'rally_master', emoji: '🎺', name: 'Rally Master', description: 'Lead 25 group rides', metric: 'groupRidesLed', threshold: 25 },
  { id: 'convoy_commander', emoji: '🎖️', name: 'Convoy Commander', description: 'Lead 50 group rides', metric: 'groupRidesLed', threshold: 50 },

  // === Group rides swept (4) ===
  { id: 'reliable_sweep', emoji: '🧹', name: 'Reliable Sweep', description: 'Sweep your first group ride', metric: 'groupRidesSwept', threshold: 1 },
  { id: 'tail_gunner', emoji: '🔫', name: 'Tail Gunner', description: 'Sweep 5 group rides', metric: 'groupRidesSwept', threshold: 5 },
  { id: 'guardian_sweep', emoji: '🛡️', name: 'Guardian Sweep', description: 'Sweep 10 group rides', metric: 'groupRidesSwept', threshold: 10 },
  { id: 'sweep_legend', emoji: '🎖️', name: 'Sweep Legend', description: 'Sweep 25 group rides', metric: 'groupRidesSwept', threshold: 25 },

  // === Safety setup (3) ===
  { id: 'guardian', emoji: '🛟', name: 'Guardian', description: 'Set an emergency contact', metric: 'emergencyContacts', threshold: 1 },
  { id: 'safety_first', emoji: '🦺', name: 'Safety First', description: 'Enable crash detection', metric: 'crashDetection', threshold: 1 },
  { id: 'background_buddy', emoji: '📡', name: 'Background Buddy', description: 'Enable background location sharing', metric: 'backgroundSharing', threshold: 1 },

  // === Total ride time (5) ===
  { id: 'first_hour', emoji: '🕐', name: 'First Hour', description: 'Spend 60 minutes riding', metric: 'totalRideTimeMin', threshold: 60, unit: 'min' },
  { id: 'time_keeper', emoji: '⏱️', name: 'Time Keeper', description: 'Spend 10 hours riding', metric: 'totalRideTimeMin', threshold: 600, unit: 'min' },
  { id: 'seat_time', emoji: '🪑', name: 'Seat Time', description: 'Spend 50 hours riding', metric: 'totalRideTimeMin', threshold: 3000, unit: 'min' },
  { id: 'full_days', emoji: '📆', name: 'Full Days', description: 'Spend 24 hours riding total', metric: 'totalRideTimeMin', threshold: 1440, unit: 'min' },
  { id: 'century_of_time', emoji: '⌛', name: 'Century of Time', description: 'Spend 100 hours riding', metric: 'totalRideTimeMin', threshold: 6000, unit: 'min' },

  // === Time of day (6) ===
  { id: 'dawn_patrol', emoji: '🌅', name: 'Dawn Patrol', description: 'Complete 5 rides before sunrise', metric: 'dawnRides', threshold: 5 },
  { id: 'early_bird', emoji: '🐦', name: 'Early Bird', description: 'Complete 15 early-morning rides', metric: 'dawnRides', threshold: 15 },
  { id: 'sunset_chaser', emoji: '🌇', name: 'Sunset Chaser', description: 'Complete 5 rides after sunset', metric: 'sunsetRides', threshold: 5 },
  { id: 'golden_hour', emoji: '🌄', name: 'Golden Hour', description: 'Complete 15 rides after sunset', metric: 'sunsetRides', threshold: 15 },
  { id: 'night_owl', emoji: '🦉', name: 'Night Owl', description: 'Complete 5 rides after dark', metric: 'nightRides', threshold: 5 },
  { id: 'midnight_rider', emoji: '🌙', name: 'Midnight Rider', description: 'Complete 20 rides after dark', metric: 'nightRides', threshold: 20 },

  // === Consistency / riding days (4) ===
  { id: 'weekend_warrior_days', emoji: '📅', name: 'Weekend Warrior', description: 'Ride on 5 different days', metric: 'ridingDays', threshold: 5 },
  { id: 'daily_rider', emoji: '📆', name: 'Daily Rider', description: 'Ride on 20 different days', metric: 'ridingDays', threshold: 20 },
  { id: 'streak_master', emoji: '🔥', name: 'Streak Master', description: 'Ride on 50 different days', metric: 'ridingDays', threshold: 50 },
  { id: 'riding_routine', emoji: '♾️', name: 'Riding Routine', description: 'Ride on 100 different days', metric: 'ridingDays', threshold: 100 },
];

export function getMetricValue(stats, metric) {
  switch (metric) {
    case 'rides': return stats.totalRides || 0;
    case 'distance': return stats.totalDistance || 0;
    case 'maxSpeed': return stats.maxSpeed || 0;
    case 'longestRideKm': return stats.longestRideKm || 0;
    case 'refills': return stats.refills || 0;
    case 'ecoRefills': return stats.ecoRefills || 0;
    case 'fullTankRefills': return stats.fullTankRefills || 0;
    case 'friends': return stats.friends || 0;
    case 'groups': return stats.groups || 0;
    case 'groupRidesLed': return stats.groupRidesLed || 0;
    case 'groupRidesSwept': return stats.groupRidesSwept || 0;
    case 'emergencyContacts': return stats.emergencyContacts || 0;
    case 'crashDetection': return stats.crashDetection || 0;
    case 'backgroundSharing': return stats.backgroundSharing || 0;
    case 'services': return stats.services || 0;
    case 'tireServices': return stats.tireServices || 0;
    case 'chainServices': return stats.chainServices || 0;
    case 'brakeServices': return stats.brakeServices || 0;
    case 'bikes': return stats.bikes || 0;
    case 'ridePlans': return stats.ridePlans || 0;
    case 'nightRides': return stats.nightRides || 0;
    case 'dawnRides': return stats.dawnRides || 0;
    case 'sunsetRides': return stats.sunsetRides || 0;
    case 'totalRideTimeMin': return stats.totalRideTimeMin || 0;
    case 'ridingDays': return stats.ridingDays || 0;
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