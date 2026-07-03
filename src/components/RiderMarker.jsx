import { Marker, Circle } from 'react-leaflet';
import L from 'leaflet';

const TRIANGLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48" fill="none">
  <ellipse cx="20" cy="42" rx="8" ry="2.4" fill="rgba(0,0,0,0.35)"/>
  <path d="M20 3 L35 39 L5 39 Z" fill="#FF7A00" stroke="#FFFFFF" stroke-width="3.5" stroke-linejoin="round"/>
</svg>`;

const RIDER_ICON = L.divIcon({
  html: `<div style="width:40px;height:48px;line-height:0;">${TRIANGLE_SVG}</div>`,
  className: 'custom-marker rider-marker',
  iconSize: [40, 48],
  iconAnchor: [20, 24],
});

const ROTATING_ICON_CACHE = {};
function getRotatedIcon(heading) {
  const key = Math.round(heading / 5) * 5;
  if (!ROTATING_ICON_CACHE[key]) {
    ROTATING_ICON_CACHE[key] = L.divIcon({
      html: `<div style="width:40px;height:48px;line-height:0;transform:rotate(${key}deg);transition:transform 0.3s ease;">${TRIANGLE_SVG}</div>`,
      className: 'custom-marker rider-marker',
      iconSize: [40, 48],
      iconAnchor: [20, 24],
    });
  }
  return ROTATING_ICON_CACHE[key];
}

export default function RiderMarker({ position, heading = null, accuracy = null, zIndex = 1200 }) {
  if (!position) return null;
  const icon = heading != null ? getRotatedIcon(heading) : RIDER_ICON;
  return (
    <>
      {accuracy != null && accuracy > 0 && (
        <Circle
          center={position}
          radius={accuracy}
          pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, stroke: true, weight: 1, opacity: 0.4 }}
        />
      )}
      <Marker
        position={position}
        icon={icon}
        zIndexOffset={zIndex}
        interactive={false}
      />
    </>
  );
}