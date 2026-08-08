/* global google */
import { getEventMarkerUrl } from '@/lib/eventMarkers';

// Native Google Maps markers pan smoothly (markerLayer moves with the map), unlike
// OverlayView-in-floatPane which stays screen-fixed during a pan and snaps on idle.
// To keep the existing circular-image look + favorite heart badge, we build the icon
// as an inline SVG data URI and cache it per (url, favorite) combination.

const HEART_PATH =
  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z';

const FAV_BADGE =
  `<circle cx="13" cy="13" r="10" fill="#ef4444" stroke="#ffffff" stroke-width="2.5"/>` +
  `<path transform="translate(6 6) scale(0.58)" d="${HEART_PATH}" fill="#ffffff"/>`;

function buildSvgDataUri(imgUrl, isFavorite) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">` +
    `<defs><clipPath id="evclip"><circle cx="28" cy="28" r="19"/></clipPath></defs>` +
    `<circle cx="28" cy="28" r="22" fill="#ffffff"/>` +
    `<image href="${imgUrl}" x="9" y="9" width="38" height="38" clip-path="url(#evclip)" preserveAspectRatio="xMidYMid slice"/>` +
    (isFavorite ? FAV_BADGE : '') +
    `</svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

const iconCache = new Map();

export function buildEventIcon(overrideUrl, category, isFavorite) {
  const key = `${overrideUrl || ''}|${category}|${isFavorite ? 1 : 0}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const url = buildSvgDataUri(overrideUrl || getEventMarkerUrl(category), isFavorite);
  // google is available here because this only runs inside a <GoogleMap> child.
  const icon = {
    url,
    scaledSize: new google.maps.Size(56, 56),
    anchor: new google.maps.Point(28, 28),
  };
  iconCache.set(key, icon);
  return icon;
}