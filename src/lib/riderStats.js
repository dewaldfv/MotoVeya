export function formatDuration(min) {
  if (!min || min <= 0) return '0m';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDistance(km) {
  if (km == null) return '0 km';
  if (km < 10) return `${Math.round(km * 10) / 10} km`;
  return `${Math.round(km)} km`;
}

export function formatRelativeDate(dateStr) {
  if (!dateStr) return 'No rides yet';
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 86400000;
  if (diff < 1) return 'Today';
  if (diff < 2) return 'Yesterday';
  if (diff < 7) return `${Math.floor(diff)} days ago`;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

export function dayLabels() {
  const labels = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    labels.push(['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]);
  }
  return labels;
}

// Approximates presence from the recency of the friend's last ride.
export function onlineStatus(lastRideDate) {
  if (!lastRideDate) return { key: 'offline', label: 'Offline', dot: 'bg-muted-foreground' };
  const diffH = (Date.now() - new Date(lastRideDate).getTime()) / 3600000;
  if (diffH < 3) return { key: 'riding', label: 'Riding', dot: 'bg-emerald-500' };
  if (diffH < 24) return { key: 'online', label: 'Online', dot: 'bg-emerald-500' };
  return { key: 'offline', label: 'Offline', dot: 'bg-muted-foreground' };
}

export function computeAchievements(r) {
  if (!r) return [];
  const out = [];
  if (r.rides_completed >= 1) out.push({ id: 'first', emoji: '🏍️', label: 'First Ride', desc: 'Completed a ride' });
  if (r.streak >= 3) out.push({ id: 's3', emoji: '🔥', label: '3-Day Streak', desc: '3 days in a row' });
  if (r.streak >= 7) out.push({ id: 's7', emoji: '⚡', label: '7-Day Streak', desc: 'A full week' });
  if (r.streak >= 30) out.push({ id: 's30', emoji: '👑', label: '30-Day Streak', desc: 'Unstoppable' });
  if (r.total_distance_km >= 100) out.push({ id: 'c100', emoji: '💯', label: 'Century', desc: '100 km total' });
  if (r.total_distance_km >= 500) out.push({ id: 'c500', emoji: '🏅', label: '500 Club', desc: '500 km total' });
  if (r.total_distance_km >= 1000) out.push({ id: 'c1000', emoji: '🏆', label: '1000 Club', desc: '1000 km total' });
  if (r.monthly?.distance_km >= 500) out.push({ id: 'rt', emoji: '🗺️', label: 'Road Tripper', desc: '500 km this month' });
  if (r.fuel?.avg_consumption_l_per_100km > 0 && r.fuel.avg_consumption_l_per_100km < 4) out.push({ id: 'eco', emoji: '🌱', label: 'Fuel Saver', desc: 'Under 4 L/100km' });
  if (r.events_count >= 1) out.push({ id: 'soc', emoji: '🎉', label: 'Social', desc: 'Joined an event' });
  if (r.events_count >= 3) out.push({ id: 'host', emoji: '🎪', label: 'Host', desc: '3 events hosted' });
  if ((r.photos?.length || 0) >= 5) out.push({ id: 'cam', emoji: '📷', label: 'Shutterbug', desc: '5 ride photos' });
  const maxSpeed = Math.max(0, ...(r.history || []).map((h) => h.max_speed_kmh || 0));
  if (maxSpeed >= 120) out.push({ id: 'spd', emoji: '🚀', label: 'Speed Demon', desc: 'Hit 120 km/h' });
  return out;
}