export const EVENT_CATEGORIES = [
  { value: 'rally', label: 'Rally', markerUrl: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/f8ae0679e_generated_image.png' },
  { value: 'breakfast_run', label: 'Breakfast Run', markerUrl: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/aa342f17d_generated_image.png' },
  { value: 'pub_ride', label: 'Pub Ride', markerUrl: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/2a06e5921_generated_image.png' },
  { value: 'birthday_bash', label: 'Birthday Bash', markerUrl: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/971f0dffe_generated_image.png' },
  { value: 'camping', label: 'Camping', markerUrl: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/df5dfb205_generated_image.png' },
  { value: 'track_day', label: 'Track Day', markerUrl: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/2f5b5ca92_generated_image.png' },
  { value: 'charity_ride', label: 'Charity Ride', markerUrl: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/496731c2c_generated_image.png' },
  { value: 'bike_night', label: 'Bike Night', markerUrl: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/a7e3c5f9d_generated_image.png' },
  { value: 'scenic_ride', label: 'Scenic Ride', markerUrl: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/6da303f0b_generated_image.png' },
  { value: 'day_jol', label: 'Day Jol', markerUrl: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/554d8eebe_generated_image.png' },
  { value: 'other', label: 'Other', markerUrl: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/71a2b2f1e_generated_image.png' },
];

export const DEFAULT_EVENT_CATEGORY = 'rally';

export function getEventMarkerUrl(category) {
  const found = EVENT_CATEGORIES.find((c) => c.value === category);
  return (found || EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1]).markerUrl;
}

// Creates a poster-specific marker without requiring another generated image asset.
// The event poster becomes the marker artwork, clipped into a motorcycle-app style pin,
// with a category badge over it. If a map renderer cannot load the embedded poster,
// the stored category marker remains the fallback.
export function getEventPosterMarkerUrl(imageUrl, category) {
  if (!imageUrl) return getEventMarkerUrl(category);
  const badge = ({ rally: '🏍️', breakfast_run: '☕', pub_ride: '🍺', birthday_bash: '🎉', camping: '⛺', track_day: '🏁', charity_ride: '❤️', bike_night: '🌙', scenic_ride: '🏞️', day_jol: '🎵', other: '🏍️' })[category] || '🏍️';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="112" viewBox="0 0 96 112"><defs><clipPath id="c"><circle cx="48" cy="44" r="31"/></clipPath><filter id="s"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".35"/></filter></defs><path d="M48 108C42 94 18 74 18 45a30 30 0 1 1 60 0c0 29-24 49-30 63z" fill="#111" filter="url(%23s)"/><circle cx="48" cy="44" r="34" fill="#fff"/><image href="${escapeXml(imageUrl)}" x="17" y="13" width="62" height="62" preserveAspectRatio="xMidYMid slice" clip-path="url(%23c)"/><circle cx="70" cy="66" r="16" fill="#111" stroke="#fff" stroke-width="3"/><text x="70" y="72" text-anchor="middle" font-size="16">${badge}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}