import { Marker, Circle } from 'react-leaflet';
import L from 'leaflet';

const RIDER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none">
  <ellipse cx="20" cy="35" rx="9" ry="2.6" fill="rgba(0,0,0,0.35)"/>
  <circle cx="20" cy="19" r="16" fill="#FF7A00" stroke="#FFFFFF" stroke-width="4"/>
  <g fill="#FFFFFF">
    <path d="M12 20.5l1.2-2.6c0.3-0.6 0.9-1 1.6-1h6.8c0.7 0 1.3 0.4 1.6 1l1.2 2.6c0.6 0.1 1.1 0.6 1.1 1.3v2.2c0 0.4-0.3 0.7-0.7 0.7h-0.6v0.8c0 0.4-0.3 0.7-0.7 0.7s-0.7-0.3-0.7-0.7v-0.8h-6.4v0.8c0 0.4-0.3 0.7-0.7 0.7s-0.7-0.3-0.7-0.7v-0.8h-0.6c-0.4 0-0.7-0.3-0.7-0.7v-2.2c0-0.7 0.5-1.2 1.1-1.3z"/>
    <circle cx="14.8" cy="22.4" r="0.7"/>
    <circle cx="24.4" cy="22.4" r="0.7"/>
  </g>
  <path d="M20 11.5l1.2 2.4 2.7 0.4-1.9 1.9 0.4 2.7-2.4-1.3-2.4 1.3 0.4-2.7-1.9-1.9 2.7-0.4z" fill="#FFFFFF" opacity="0.25"/>
</svg>`;

const RIDER_ICON = L.divIcon({
  html: `<div style="width:40px;height:40px;line-height:0;">${RIDER_SVG}</div>`,
  className: 'custom-marker rider-marker',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const ROTATING_ICON_CACHE = {};
function getRotatedIcon(heading) {
  const key = Math.round(heading / 5) * 5;
  if (!ROTATING_ICON_CACHE[key]) {
    ROTATING_ICON_CACHE[key] = L.divIcon({
      html: `<div style="width:40px;height:40px;line-height:0;transform:rotate(${key}deg);transition:transform 0.3s ease;">${RIDER_SVG}</div>`,
      className: 'custom-marker rider-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
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