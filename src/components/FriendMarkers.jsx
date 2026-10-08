import { useEffect, useState } from 'react';
import { useMapInstance } from '@/lib/maplibreContext';
import CustomMapMarker from './CustomMapMarker';

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

function FriendArrow({ friend, onSelect, zIndex }) {
  const status = computeStatus(friend);
  const color = STATUS_COLORS[status];
  const heading = friend.heading != null ? Math.round(friend.heading / 5) * 5 : null;
  const rotation = heading != null ? `transform:rotate(${heading}deg);transition:transform 0.3s ease;` : '';
  const ring = status === 'distress' ? '<div class="friend-distress-ring"></div>' : '';
  return (
    <CustomMapMarker
      position={[friend.lat, friend.lng]}
      onClick={() => onSelect?.(friend)}
      zIndex={zIndex}
    >
      <div style={{ position: 'relative', width: 40, height: 48, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: `${ring}<div style="${rotation}">${arrowSvg(color)}</div>` }} />
    </CustomMapMarker>
  );
}

function ClusterPin({ count, lat, lng, onClick, zIndex }) {
  return (
    <CustomMapMarker position={[lat, lng]} onClick={onClick} zIndex={zIndex}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'hsl(26 100% 50%)', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 16, fontFamily: 'Inter,sans-serif' }}>
        {count}
      </div>
    </CustomMapMarker>
  );
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
  const map = useMapInstance();
  const [zoom, setZoom] = useState(map?.getZoom() || 12);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!map) return;
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoom', onZoom);
    return () => map.off('zoom', onZoom);
  }, [map]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const visible = friends.filter((f) => f.lat != null && f.lng != null);
  const items = clusterFriends(visible, zoom);

  return items.map((item, i) => {
    if (item.type === 'cluster') {
      return (
        <ClusterPin
          key={`fcluster-${i}`}
          count={item.friends.length}
          lat={item.lat}
          lng={item.lng}
          zIndex={900}
          onClick={() => {
            if (map) {
              map.setZoom(Math.max(zoom + 2, 14));
              map.panTo([item.lng, item.lat]);
            }
          }}
        />
      );
    }
    const status = computeStatus(item.friend);
    return (
      <FriendArrow
        key={`friend-${item.friend.id}`}
        friend={item.friend}
        onSelect={onSelect}
        zIndex={status === 'distress' ? 1100 : 1000}
      />
    );
  });
}