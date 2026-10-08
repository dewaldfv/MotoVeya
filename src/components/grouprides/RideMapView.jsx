import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import MapLibreContainer from '@/components/MapLibreContainer';
import MapLibreLine from '@/components/MapLibreLine';
import CustomMapMarker from '@/components/CustomMapMarker';
import { useMapInstance } from '@/lib/maplibreContext';

const SA_CENTER = [-26.2041, 28.0473];

function FitBounds({ participants, route, destination }) {
  const map = useMapInstance();
  useEffect(() => {
    if (!map) return;
    const pts = [];
    participants.forEach((p) => { if (p.lat != null) pts.push([p.lng, p.lat]); });
    if (route?.length) route.forEach(([lat, lng]) => pts.push([lng, lat]));
    if (destination?.lat != null) pts.push([destination.lng, destination.lat]);
    if (pts.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      pts.forEach((pt) => bounds.extend(pt));
      map.fitBounds(bounds, { padding: 60 });
    } else if (pts.length === 1) {
      map.setCenter(pts[0]);
      map.setZoom(14);
    }
  }, [map, participants, route, destination]);
  return null;
}

function riderVisual(role, isSelf) {
  const ring = role === 'leader' ? '#f59e0b' : role === 'sweep' ? '#475569' : isSelf ? '#2D7FF9' : '#ffffff';
  const bg = role === 'leader' ? '#f59e0b' : role === 'sweep' ? '#334155' : isSelf ? '#2D7FF9' : '#0f172a';
  const emoji = role === 'leader' ? '\ud83d\udc51' : role === 'sweep' ? '\ud83d\udee1\ufe0f' : '\ud83c\udfcd\ufe0f';
  return (
    <div style={{ position: 'relative', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, border: `3px solid ${ring}`, borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,.5)', fontSize: 16 }}>
      {emoji}
    </div>
  );
}

export default function RideMapView({ participants = [], route = [], breadcrumb = [], hazards = [], destination, fuelStop, restStop, user, selfPos }) {
  const centerArr = selfPos || SA_CENTER;

  return (
    <MapLibreContainer center={centerArr} zoom={13} layer="standard">
      <FitBounds participants={participants} route={route} destination={destination} />

      {breadcrumb.length > 1 && (
        <MapLibreLine id="breadcrumb" coordinates={breadcrumb} color="#f59e0b" width={4} opacity={0.5} dasharray={[0, 8, 6]} />
      )}
      {route.length > 1 && (
        <>
          <MapLibreLine id="group-route-casing" coordinates={route} color="#ffffff" width={9} opacity={0.9} />
          <MapLibreLine id="group-route" coordinates={route} color="#2D7FF9" width={5} opacity={1} />
        </>
      )}

      {hazards.map((h, i) => (
        <CustomMapMarker key={`h${i}`} position={[h.lat, h.lng]}>
          <div style={{ width: 28, height: 28, background: '#dc2626', border: '2px solid #fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, boxShadow: '0 2px 6px rgba(0,0,0,.4)' }}>{'\u26a0\ufe0f'}</div>
        </CustomMapMarker>
      ))}

      {fuelStop?.lat != null && (
        <CustomMapMarker position={[fuelStop.lat, fuelStop.lng]}>
          <div style={{ width: 24, height: 24, background: '#fff', border: '2px solid hsl(26 100% 50%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,.3)' }}>{'\u26fd'}</div>
        </CustomMapMarker>
      )}
      {restStop?.lat != null && (
        <CustomMapMarker position={[restStop.lat, restStop.lng]}>
          <div style={{ width: 24, height: 24, background: '#fff', border: '2px solid hsl(26 100% 50%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,.3)' }}>{'\u2615'}</div>
        </CustomMapMarker>
      )}
      {destination?.lat != null && (
        <CustomMapMarker position={[destination.lat, destination.lng]} anchor="bottom">
          <div style={{ width: 26, height: 26, background: '#4285F4', borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,.5)' }} />
        </CustomMapMarker>
      )}

      {participants.map((p) =>
        p.lat != null ? (
          <CustomMapMarker key={p.user_id} position={[p.lat, p.lng]}>
            {riderVisual(p.role, p.user_id === user?.id)}
          </CustomMapMarker>
        ) : null
      )}
    </MapLibreContainer>
  );
}