import { useEffect, useState } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

const STATUS_COLORS = {
  active: '#3b82f6',
  inactive: '#1a1a1a',
  distress: '#ef4444',
};

const STATIONARY_SPEED = 5;
const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

function computeStatus(f) {
  if (f.is_distress) return 'distress';
  const speed = f.speed_kmh || 0;
  const ageMs = f.last_updated ? Date.now() - new Date(f.last_updated).getTime() : Infinity;
  if (speed > STATIONARY_SPEED && ageMs < ACTIVE_WINDOW_MS) return 'active';
  return 'inactive';
}

function arrowSvg(color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48" fill="none">
  <ellipse cx="20" cy="42" rx="8" ry="2.4" fill="rgba(0,0,0,0.35)"/>
  <path d="M20 3 L35 39 L5 39 Z" fill="${color}" stroke="#FFFFFF" stroke-width="3.5" stroke-linejoin="round"/>
</svg>`;
}

const iconCache = {};
function getArrowIcon(color, heading, isDistress) {
  const h = heading != null ? Math.round(heading / 5) * 5 : null;
  const key = `${color}-${h}-${isDistress}`;
  if (!iconCache[key]) {
    const rotation = h != null ? `transform:rotate(${h}deg);transition:transform 0.3s ease;` : '';
    const ring = isDistress ? '<div class="friend-distress-ring"></div>' : '';
    iconCache[key] = L.divIcon({
      html: `<div style="position:relative;width:40px;height:48px;line-height:0;">${ring}<div style="${rotation}">${arrowSvg(color)}</div></div>`,
      className: 'custom-marker',
      iconSize: [40, 48],
      iconAnchor: [20, 24],
    });
  }
  return iconCache[key];
}

function clusterIcon(count) {
  return L.divIcon({
    html: `<div style="width:44px;height:44px;border-radius:50%;background:hsl(26 100% 50%);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:16px;font-family:Inter,sans-serif;">${count}</div>`,
    className: 'custom-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function clusterFriends(friends, zoom) {
  if (zoom >= 14) return friends.map((f) => ({ type: 'single', friend: f }));
  const precision = zoom >= 12 ? 0.003 : 0.01;
  const groups = new Map();
  for (const f of friends) {
    const key = `${Math.round(f.lat / precision)},${Math.round(f.lng / precision)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  const items = [];
  for (const [, group] of groups) {
    if (group.length === 1) {
      items.push({ type: 'single', friend: group[0] });
    } else {
      const avgLat = group.reduce((s, f) => s + f.lat, 0) / group.length;
      const avgLng = group.reduce((s, f) => s + f.lng, 0) / group.length;
      items.push({ type: 'cluster', friends: group, lat: avgLat, lng: avgLng });
    }
  }
  return items;
}

export default function FriendMarkers({ friends = [], onSelect }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setZoom(map.getZoom());
    map.on('zoomend', handler);
    return () => map.off('zoomend', handler);
  }, [map]);

  // Re-evaluate statuses periodically so active→inactive transitions happen without a new poll.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const visible = friends.filter((f) => f.lat != null && f.lng != null);
  const items = clusterFriends(visible, zoom);

  return items.map((item, i) => {
    if (item.type === 'cluster') {
      return (
        <Marker
          key={`fcluster-${i}`}
          position={[item.lat, item.lng]}
          icon={clusterIcon(item.friends.length)}
          zIndexOffset={900}
          eventHandlers={{ click: () => map.setView([item.lat, item.lng], Math.max(zoom + 2, 14)) }}
        />
      );
    }
    const f = item.friend;
    const status = computeStatus(f);
    const color = STATUS_COLORS[status];
    const icon = getArrowIcon(color, f.heading, status === 'distress');
    return (
      <Marker
        key={`friend-${f.id}`}
        position={[f.lat, f.lng]}
        icon={icon}
        zIndexOffset={status === 'distress' ? 1100 : 1000}
        eventHandlers={{ click: () => onSelect?.(f) }}
      />
    );
  });
}