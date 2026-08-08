import { Marker } from '@react-google-maps/api';
import { buildEventIcon } from '@/lib/eventMarkerIcon';

/**
 * Renders an event as a native Google Maps Marker (markerLayer), which pans with the
 * map and never drifts/flickers — unlike floatPane OverlayView markers.
 * Keeps the circular-image look and optional favorite heart badge via an SVG icon.
 */
export default function EventMarker({ event, isFavorite = false, onClick, zIndex = 1000 }) {
  if (!event || event.lat == null || event.lng == null) return null;
  const icon = buildEventIcon(event.markerIcon, event.category, isFavorite);
  return (
    <Marker
      position={{ lat: event.lat, lng: event.lng }}
      icon={icon}
      zIndex={zIndex}
      onClick={() => onClick?.(event)}
    />
  );
}