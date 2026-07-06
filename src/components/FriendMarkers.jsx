import { Marker } from 'react-leaflet';
import L from 'leaflet';

function friendIcon(name) {
  const initial = (name?.trim()?.[0] || 'R').toUpperCase();
  return L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
        <div style="width:36px;height:36px;border-radius:50%;background:hsl(26 100% 50%);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:15px;font-family:Inter,sans-serif;">${initial}</div>
        <div style="background:rgba(15,23,33,.85);color:#fff;font-size:10px;font-weight:600;padding:1px 6px;border-radius:999px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:Inter,sans-serif;">${name || 'Rider'}</div>
      </div>`,
    className: 'custom-marker',
    iconSize: [36, 52],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

export default function FriendMarkers({ friends = [], onSelect }) {
  return friends.map((f) => (
    <Marker
      key={`friend-${f.id}`}
      position={[f.lat, f.lng]}
      icon={friendIcon(f.name)}
      eventHandlers={{ click: () => onSelect?.(f) }}
    />
  ));
}