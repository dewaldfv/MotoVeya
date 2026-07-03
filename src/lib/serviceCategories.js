export const SERVICE_CATEGORIES = {
  dealership: { label: 'Motorcycle Dealerships', icon: '🏍️', color: '#FF6A00', filter: 'Dealers' },
  workshop: { label: 'Repair Workshops', icon: '🔧', color: '#3b82f6', filter: 'Workshops' },
  tyres: { label: 'Tyre Shops', icon: '🛞', color: '#64748b', filter: 'Tyres' },
  gear: { label: 'Riding Gear & Apparel', icon: '🪖', color: '#8b5cf6', filter: 'Gear' },
  parts: { label: 'Parts & Accessories', icon: '⚙️', color: '#f59e0b', filter: 'Parts' },
  fuel: { label: 'Fuel Stations', icon: '⛽', color: '#22c55e', filter: 'Fuel' },
  food: { label: 'Cafés & Restaurants', icon: '🍔', color: '#ef4444', filter: 'Food' },
  accommodation: { label: 'Camping & Accommodation', icon: '🏕️', color: '#06b6d4', filter: 'Accommodation' },
  emergency: { label: 'Towing & Roadside', icon: '🚨', color: '#dc2626', filter: 'Emergency' },
  wash: { label: 'Bike Wash', icon: '🧽', color: '#0ea5e9', filter: 'Other' },
  battery: { label: 'Battery Suppliers', icon: '🔋', color: '#10b981', filter: 'Other' },
  custom: { label: 'Custom Bike Builders', icon: '🛠️', color: '#f97316', filter: 'Other' },
  other: { label: 'Other Services', icon: '📍', color: '#6b7280', filter: 'Other' },
};

export const FILTER_CHIPS = ['All', 'Dealers', 'Workshops', 'Gear', 'Tyres', 'Parts', 'Fuel', 'Food', 'Accommodation', 'Emergency'];

export const RADIUS_OPTIONS = [10, 25, 50, 100, 200];

export function getCategoryConfig(category) {
  return SERVICE_CATEGORIES[category] || SERVICE_CATEGORIES.other;
}

export function categorizeByTags(tags) {
  if (!tags) return 'other';
  if (tags.shop === 'motorcycle') return 'dealership';
  if (tags.shop === 'motorcycle_repair') return 'workshop';
  if (tags.shop === 'tyres') return 'tyres';
  if (tags.amenity === 'fuel') return 'fuel';
  if (['cafe', 'restaurant', 'fast_food', 'pub', 'bar'].includes(tags.amenity)) return 'food';
  if (['hotel', 'guest_house', 'camp_site', 'hostel', 'motel'].includes(tags.tourism)) return 'accommodation';
  if (tags.amenity === 'car_wash') return 'wash';
  if (tags.amenity === 'car_repair' || tags.shop === 'car_repair') return 'workshop';
  return 'other';
}