export const RIDE_ICONS = ['🏍️', '🌅', '☕', '🍺', '🏕️', '🏁', '🏔️', '🏖️', '🌮', '🍻', '🎉', '✝️'];

export const RIDE_STATUS = {
  planning: { label: 'Planning', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  waiting: { label: 'Waiting', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  riding: { label: 'Riding', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  paused: { label: 'Paused', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  finished: { label: 'Finished', color: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
};

export const RIDING_STATUS = {
  riding: { label: 'Riding', color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  stopped: { label: 'Stopped', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  fuel_stop: { label: 'Fuel Stop', color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  rest_stop: { label: 'Rest Stop', color: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  emergency: { label: 'Emergency', color: 'text-destructive', dot: 'bg-destructive' },
};

export const COMM_SIGNALS = [
  { type: 'ready', label: 'Ready', emoji: '✅', color: 'bg-emerald-500' },
  { type: 'fuel', label: 'Need Fuel', emoji: '⛽', color: 'bg-amber-500' },
  { type: 'coffee', label: 'Coffee Stop', emoji: '☕', color: 'bg-orange-700' },
  { type: 'slow', label: 'Slow Down', emoji: '🐢', color: 'bg-blue-500' },
  { type: 'hazard', label: 'Hazard Ahead', emoji: '⚠️', color: 'bg-yellow-500' },
  { type: 'pullover', label: 'Pull Over', emoji: '🛑', color: 'bg-red-500' },
  { type: 'distress', label: 'Distress', emoji: '🆘', color: 'bg-destructive' },
];

export function formatDuration(min) {
  if (!min || min <= 0) return '0m';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export async function geocode(query) {
  if (!query?.trim()) return null;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=za`);
    const data = await res.json();
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: data[0].display_name.split(',')[0] };
  } catch (e) { return null; }
}

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}