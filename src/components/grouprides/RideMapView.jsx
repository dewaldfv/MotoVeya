import L from 'leaflet';
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, useMap } from 'react-leaflet';
import { useEffect } from 'react';

function FitBounds({ participants, route, destination }) {
  const map = useMap();
  useEffect(() => {
    const pts = [];
    participants.forEach((p) => { if (p.lat != null) pts.push([p.lat, p.lng]); });
    if (route?.length) pts.push(...route);
    if (destination?.lat != null) pts.push([destination.lat, destination.lng]);
    if (pts.length > 1) {
      try { map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 15 }); } catch (e) {}
    } else if (pts.length === 1) {
      map.setView(pts[0], 14);
    }
  }, [participants, route, destination, map]);
  return null;
}

function riderIcon(role, isSelf, name, heading) {
  const ring = role === 'leader' ? '#f59e0b' : role === 'sweep' ? '#475569' : isSelf ? '#2D7FF9' : '#ffffff';
  const bg = role === 'leader' ? '#f59e0b' : role === 'sweep' ? '#334155' : isSelf ? '#2D7FF9' : '#0f172a';
  const emoji = role === 'leader' ? '👑' : role === 'sweep' ? '🛡️' : '🏍️';
  return L.divIcon({
    html: `<div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:${bg};border:3px solid ${ring};border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.5);font-size:16px">${emoji}</div>`,
    className: 'custom-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

const hazardIcon = L.divIcon({
  html: '<div style="width:28px;height:28px;background:#dc2626;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.4)">⚠️</div>',
  className: 'custom-marker',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const destIcon = L.divIcon({
  html: '<div style="width:26px;height:26px;background:#4285F4;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>',
  className: 'custom-marker',
  iconSize: [26, 26],
  iconAnchor: [13, 24],
});

const stopIcon = (emoji) => L.divIcon({
  html: `<div style="width:24px;height:24px;background:#fff;border:2px solid hsl(26 100% 50%);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,.3)">${emoji}</div>`,
  className: 'custom-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export default function RideMapView({ participants = [], route = [], breadcrumb = [], hazards = [], destination, fuelStop, restStop, user, selfPos }) {
  return (
    <MapContainer center={selfPos || [-26.2041, 28.0473]} zoom={13} zoomControl={false} className="absolute inset-0 h-full w-full">
      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
      <FitBounds participants={participants} route={route} destination={destination} />

      {breadcrumb.length > 1 && (
        <Polyline positions={breadcrumb} pathOptions={{ color: '#f59e0b', weight: 4, opacity: 0.5, dashArray: '6 8' }} />
      )}
      {route.length > 1 && (
        <>
          <Polyline positions={route} pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.9 }} />
          <Polyline positions={route} pathOptions={{ color: '#2D7FF9', weight: 5, opacity: 1 }} />
        </>
      )}

      {hazards.map((h, i) => (
        <Marker key={`h${i}`} position={[h.lat, h.lng]} icon={hazardIcon} />
      ))}

      {fuelStop?.lat != null && <Marker position={[fuelStop.lat, fuelStop.lng]} icon={stopIcon('⛽')} />}
      {restStop?.lat != null && <Marker position={[restStop.lat, restStop.lng]} icon={stopIcon('☕')} />}
      {destination?.lat != null && <Marker position={[destination.lat, destination.lng]} icon={destIcon} />}

      {participants.map((p) => (
        p.lat != null && (
          <Marker key={p.user_id} position={[p.lat, p.lng]} icon={riderIcon(p.role, p.user_id === user?.id, p.user_name, p.heading)} />
        )
      ))}
    </MapContainer>
  );
}