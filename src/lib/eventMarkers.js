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