import { AlertTriangle } from 'lucide-react';

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return NaN;
  return Number(value);
};

// An event only reaches the map when it carries a real point. Missing, zeroed
// (null island) or out-of-range values all keep it off the map.
export function hasMapCoordinates(event) {
  const lat = toNumber(event?.lat);
  const lng = toNumber(event?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

export default function EventCoordinateWarning({ event }) {
  if (!event || hasMapCoordinates(event)) return null;
  const message = 'No map coordinates — this event cannot appear on the map';
  return (
    <span
      role="img"
      aria-label={message}
      title={message}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400"
    >
      <AlertTriangle size={12} aria-hidden="true" />
      No location
    </span>
  );
}