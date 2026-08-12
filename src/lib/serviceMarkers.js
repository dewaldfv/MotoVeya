import { getServiceCategory } from './serviceCategories';

const ICON_SIZE = 44;

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

// Builds a teardrop-free circular pin (matches the round event-pin aesthetic) in the
// service category colour with the category emoji centred. Returned as an SVG data URI
// so it can be used directly as a google.maps.Marker icon URL — no image upload needed.
function buildPinSvg(color, emoji) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">
  <circle cx="22" cy="22" r="20" fill="${color}" stroke="#ffffff" stroke-width="3"/>
  <text x="22" y="30" font-size="20" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${escapeXml(emoji)}</text>
</svg>`;
}

function buildClusterSvg(count) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">
  <circle cx="22" cy="22" r="20" fill="#FF6F00" stroke="#ffffff" stroke-width="3"/>
  <text x="22" y="29" font-size="16" font-weight="bold" text-anchor="middle" fill="#ffffff" font-family="sans-serif">${count}</text>
</svg>`;
}

const markerUrlCache = {};

export function getServiceMarkerUrl(category) {
  const cat = getServiceCategory(category);
  if (markerUrlCache[cat.key]) return markerUrlCache[cat.key];
  const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(buildPinSvg(cat.color, cat.emoji))}`;
  markerUrlCache[cat.key] = url;
  return url;
}

export function getClusterMarkerUrl(count) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(buildClusterSvg(count))}`;
}