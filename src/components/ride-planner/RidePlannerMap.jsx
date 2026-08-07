/* global google */
import { useEffect, useRef } from 'react';
import { GoogleMap, Polyline, useGoogleMap } from '@react-google-maps/api';
import { useGoogleMapsLoaded } from '@/lib/googleMapsLoader';
import { getMapOptions, getLayerStyles } from '@/lib/mapLayers';
import CustomMapMarker from '@/components/CustomMapMarker';

const SA_CENTER = [-26.2041, 28.0473];

function LayerController() {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map) return;
    map.setMapTypeId('roadmap');
    map.setOptions({ styles: getLayerStyles('standard') });
  }, [map]);
  return null;
}

function FitWaypoints({ waypoints }) {
  const map = useGoogleMap();
  const done = useRef(false);
  useEffect(() => {
    if (!map || waypoints.length === 0) return;
    if (waypoints.length === 1) {
      map.setCenter({ lat: waypoints[0].lat, lng: waypoints[0].lng });
      map.setZoom(13);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    waypoints.forEach((w) => bounds.extend({ lat: w.lat, lng: w.lng }));
    map.fitBounds(bounds, 80);
    done.current = true;
  }, [map, waypoints.length, waypoints.map((w) => `${w.lat},${w.lng}`).join('|')]);
  return null;
}

function wpColor(i, total) {
  if (i === 0) return '#22c55e';
  if (i === total - 1) return '#ef4444';
  return '#FF6F00';
}

const STOP_ICON = { fuel: '⛽', food: '🍻' };

export default function RidePlannerMap({ waypoints = [], suggestedStops = [] }) {
  const isLoaded = useGoogleMapsLoaded();
  const center = waypoints[0] ? [waypoints[0].lat, waypoints[0].lng] : SA_CENTER;
  const initialCenterRef = useRef(null);
  if (!initialCenterRef.current) initialCenterRef.current = { lat: center[0], lng: center[1] };

  if (!isLoaded) {
    return <div className="h-72 w-full rounded-2xl bg-muted" />;
  }

  const path = waypoints.map((w) => ({ lat: w.lat, lng: w.lng }));

  return (
    <div className="relative h-72 w-full overflow-hidden rounded-2xl border border-border bg-card">
      <GoogleMap
        mapContainerClassName="absolute inset-0 h-full w-full"
        center={initialCenterRef.current}
        zoom={6}
        options={{ ...getMapOptions('standard'), gestureHandling: 'auto', draggable: true, scrollwheel: true }}
      >
        <LayerController />
        <FitWaypoints waypoints={waypoints} />
        {path.length > 1 && (
          <>
            <Polyline path={path} options={{ strokeColor: '#ffffff', strokeWeight: 7, strokeOpacity: 0.9 }} />
            <Polyline path={path} options={{ strokeColor: '#FF6F00', strokeWeight: 4, strokeOpacity: 1 }} />
          </>
        )}
        {waypoints.map((w, i) => (
          <CustomMapMarker key={`${w.lat},${w.lng}-${i}`} position={[w.lat, w.lng]} anchor="center" zIndex={100 + i}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: wpColor(i, waypoints.length), color: 'white',
              border: '3px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800,
            }}>{i + 1}</div>
          </CustomMapMarker>
        ))}
        {suggestedStops.map((s) => (
          <CustomMapMarker
            key={`sug-${s.key}`}
            position={[s.lat, s.lng]}
            anchor="center"
            zIndex={50}
          >
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: s.type === 'fuel' ? '#f59e0b' : '#8b5cf6',
              color: 'white',
              border: '2px dashed white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
              opacity: 0.92,
            }} title={`Suggested ${s.type === 'fuel' ? 'fuel stop' : 'pub / food stop'}`}>
              {STOP_ICON[s.type] || '📍'}
            </div>
          </CustomMapMarker>
        ))}
      </GoogleMap>
    </div>
  );
}