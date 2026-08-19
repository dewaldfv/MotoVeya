export const SERVICE_CATEGORIES = [
  { key: 'maintenance_repair', label: 'Maintenance & Repairs', short: 'Repairs', emoji: '🔧', color: '#3b82f6' },
  { key: 'tyres_wheels', label: 'Tyres & Wheel Services', short: 'Tyres', emoji: '🛞', color: '#1f2937' },
  { key: 'batteries', label: 'Batteries', short: 'Batteries', emoji: '🔋', color: '#10b981' },
  { key: 'oil_lubricants', label: 'Oil & Lubricants', short: 'Oil', emoji: '🛢', color: '#f59e0b' },
  { key: 'spare_parts', label: 'Spare Parts', short: 'Parts', emoji: '⚙', color: '#6b7280' },
  { key: 'dealerships', label: 'Motorcycle Dealerships', short: 'Dealers', emoji: '🏍', color: '#06b6d4' },
  { key: 'riding_gear', label: 'Riding Gear & Apparel', short: 'Gear', emoji: '👕', color: '#8b5cf6' },
  { key: 'custom_paint', label: 'Custom Paint & Wraps', short: 'Paint', emoji: '🎨', color: '#ec4899' },
  { key: 'custom_builders', label: 'Custom Bike Builders', short: 'Builders', emoji: '🔥', color: '#ef4444' },
  { key: 'performance_tuning', label: 'Performance Tuning', short: 'Tuning', emoji: '💨', color: '#f97316' },
  { key: 'electrical', label: 'Electrical Repairs', short: 'Electrical', emoji: '⚡', color: '#eab308' },
  { key: 'suspension', label: 'Suspension Specialists', short: 'Suspension', emoji: '🛠', color: '#0ea5e9' },
  { key: 'chains_sprockets', label: 'Chains & Sprockets', short: 'Chains', emoji: '⛓', color: '#71717a' },
  { key: 'detailing', label: 'Bike Detailing & Ceramic', short: 'Detailing', emoji: '🧽', color: '#14b8a6' },
  { key: 'transport', label: 'Motorcycle Transport', short: 'Transport', emoji: '🚚', color: '#6366f1' },
  { key: 'roadside_assist', label: 'Roadside Assistance', short: 'Roadside', emoji: '🚨', color: '#dc2626' },
  { key: 'training_schools', label: 'Training Schools', short: 'Training', emoji: '🏍', color: '#059669' },
  { key: 'photography', label: 'Photography & Media', short: 'Media', emoji: '📷', color: '#a855f7' },
  { key: 'food_restaurant', label: 'Restaurants', short: 'Restaurants', emoji: '🍽️', color: '#ef4444' },
  { key: 'food_pub_bar', label: 'Pubs & Bars', short: 'Pubs & Bars', emoji: '🍺', color: '#f59e0b' },
  { key: 'food_cafe', label: 'Cafés', short: 'Cafés', emoji: '☕', color: '#92400e' },
  { key: 'food_fast_food', label: 'Fast Food', short: 'Fast Food', emoji: '🍔', color: '#f97316' },
  { key: 'food_breakfast', label: 'Breakfast Spots', short: 'Breakfast', emoji: '🥓', color: '#eab308' },
  { key: 'food_bakery', label: 'Bakeries', short: 'Bakeries', emoji: '🥐', color: '#d97706' },
  { key: 'food_market', label: 'Food Markets', short: 'Food Markets', emoji: '🌮', color: '#16a34a' },
];

export function getServiceCategory(key) {
  return SERVICE_CATEGORIES.find((c) => c.key === key) || SERVICE_CATEGORIES[0];
}

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km) {
  if (km == null) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function isOpenNow(service) {
  if (service.is_open_24h) return true;
  if (!service.opening_hours) return true;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const match = service.opening_hours.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (match) {
    const open = parseInt(match[1]) * 60 + parseInt(match[2]);
    const close = parseInt(match[3]) * 60 + parseInt(match[4]);
    return currentMinutes >= open && currentMinutes <= close;
  }
  return true;
}