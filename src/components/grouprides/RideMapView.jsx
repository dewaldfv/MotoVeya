/* global google */
import { useEffect, useRef } from 'react';
import { GoogleMap, Polyline, useGoogleMap } from '@react-google-maps/api';
import { useGoogleMapsLoaded } from '@/lib/googleMapsLoader';
import { getMapOptions } from '@/lib/mapLayers';
import CustomMapMarker from '../CustomMapMarker';

const SA_CENTER = [-26.2041, 28.0473];

function FitBounds({ participants, route, destination }) {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map) return;
    const pts = [];
    participants.forEach((p) => { if (p.lat != null) pts.push({ lat: p.lat, lng: p.lng }); });
    if (route?.length) route.forEach(([lat, lng]) => pts.push({ lat, lng }));
    if (destination?.lat != null) pts.push({ lat: destination.lat, lng: destination.lng });
    if (pts.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      pts.forEach((pt) => bounds.extend(pt));
      map.fitBounds(bounds, 60);
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
  const emoji = role === 'leader' ? '👑' : role === 'sweep' ? '🛡️' : '🏍️';
  return (
    <div style={{ position: 'relative', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, border: `3px solid ${ring}`, borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,.5)', fontSize: 16 }}>
      {emoji}
    </div>
  );
}

function toLatLngPath(coords) {
  return (coords || []).map(([lat, lng]) => ({ lat, lng }));
}

export default function RideMapView({ participants = [], route = [], breadcrumb = [], hazards = [], destination, fuelStop, restStop, user, selfPos }) {
  const isLoaded = useGoogleMapsLoaded();
  const initialCenterRef = useRef(null);
  const centerArr = selfPos || SA_CENTER;
  if (!initialCenterRef.current) {
    initialCenterRef.current = { lat: centerArr[0], lng: centerArr[1] };
  }

  if (!isLoaded) {
    return <div className="absolute inset-0" style={{ background: '#1a1a1a' }} />;
  }

  return (
    <GoogleMap
      mapContainerClassName="absolute inset-0 h-full w-full"
      center={initialCenterRef.current}
      zoom={13}
      options={getMapOptions('standard')}
    >
      <FitBounds participants={participants} route={route} destination={destination} />

      {breadcrumb.length > 1 && (
        <Polyline path={toLatLngPath(breadcrumb)} options={{ strokeColor: '#f59e0b', strokeWeight: 4, strokeOpacity: 0.5, strokeDashArray: '0 8 6' }} />
      )}
      {route.length > 1 && (
        <>
          <Polyline path={toLatLngPath(route)} options={{ strokeColor: '#ffffff', strokeWeight: 9, strokeOpacity: 0.9 }} />
          <Polyline path={toLatLngPath(route)} options={{ strokeColor: '#2D7FF9', strokeWeight: 5, strokeOpacity: 1 }} />
        </>
      )}

      {hazards.map((h, i) => (
        <CustomMapMarker key={`h${i}`} position={[h.lat, h.lng]}>
          <div style={{ width: 28, height: 28, background: '#dc2626', border: '2px solid #fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, boxShadow: '0 2px 6px rgba(0,0,0,.4)' }}>⚠️</div>
        </CustomMapMarker>
      ))}

      {fuelStop?.lat != null && (
        <CustomMapMarker position={[fuelStop.lat, fuelStop.lng]}>
          <div style={{ width: 24, height: 24, background: '#fff', border: '2px solid hsl(26 100% 50%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,.3)' }}>⛽</div>
        </CustomMapMarker>
      )}
      {restStop?.lat != null && (
        <CustomMapMarker position={[restStop.lat, restStop.lng]}>
          <div style={{ width: 24, height: 24, background: '#fff', border: '2px solid hsl(26 100% 50%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, boxShadow: '0 1px 4px rgba(0,0,0,.3)' }}>☕</div>
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
    </GoogleMap>
  );
}