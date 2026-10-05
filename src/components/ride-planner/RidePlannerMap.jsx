/* global google */
import { useEffect, useRef } from 'react';
import { GoogleMap, Marker, Polyline, useGoogleMap } from '@react-google-maps/api';
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
  }, [map, waypoints.length]);
  return null;
}

function wpColor(i, total) {
  if (i === 0) return '#22c55e';
  if (i === total - 1) return '#ef4444';
  return '#FF6F00';
}

const STOP_ICON = { fuel: '⛽', food: '🍻' };

function wpIcon(color, number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><circle cx="17" cy="17" r="14" fill="${color}" stroke="white" stroke-width="3"/><text x="17" y="22" font-size="14" font-weight="800" fill="white" text-anchor="middle" font-family="Inter,Arial,sans-serif">${number}</text></svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(34, 34),
    anchor: new google.maps.Point(17, 17),
  };
}

export default function RidePlannerMap({ waypoints = [], routeData = null, routeLoading = false, suggestedStops = [], onWaypointDrag }) {
  const isLoaded = useGoogleMapsLoaded();
  const center = waypoints[0] ? [waypoints[0].lat, waypoints[0].lng] : SA_CENTER;
  const initialCenterRef = useRef(null);
  if (!initialCenterRef.current) initialCenterRef.current = { lat: center[0], lng: center[1] };

  if (!isLoaded) {
    return <div className="h-72 w-full rounded-2xl bg-muted" />;
  }

  const path = (routeData?.coordinates?.length ? routeData.coordinates : waypoints.map((w) => [w.lat, w.lng]))
    .map(([lat, lng]) => ({ lat, lng }));

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
            <Polyline path={path} options={{ strokeColor: '#ffffff', strokeWeight: 8, strokeOpacity: 0.9 }} />
            <Polyline path={path} options={{ strokeColor: '#FF6F00', strokeWeight: 5, strokeOpacity: 1 }} />
          </>
        )}
        {routeLoading && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1.5 text-xs font-semibold text-white">
            Calculating route…
          </div>
        )}
        {waypoints.map((w, i) => (
          <Marker
            key={`wp-${i}`}
            position={{ lat: w.lat, lng: w.lng }}
            draggable
            icon={wpIcon(wpColor(i, waypoints.length), i + 1)}
            zIndex={100 + i}
            onDragEnd={(e) => onWaypointDrag?.(i, { lat: e.latLng.lat(), lng: e.latLng.lng() })}
          />
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