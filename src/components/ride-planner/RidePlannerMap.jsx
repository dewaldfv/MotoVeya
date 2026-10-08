import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import MapLibreContainer from '@/components/MapLibreContainer';
import MapLibreLine from '@/components/MapLibreLine';
import CustomMapMarker from '@/components/CustomMapMarker';
import { useMapInstance } from '@/lib/maplibreContext';

const SA_CENTER = [-26.2041, 28.0473];

function FitWaypoints({ waypoints }) {
  const map = useMapInstance();
  const done = useRef(false);
  useEffect(() => {
    if (!map || waypoints.length === 0 || done.current) return;
    if (waypoints.length === 1) {
      map.setCenter([waypoints[0].lng, waypoints[0].lat]);
      map.setZoom(13);
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    waypoints.forEach((w) => bounds.extend([w.lng, w.lat]));
    map.fitBounds(bounds, { padding: 80 });
    done.current = true;
  }, [map, waypoints.length]);
  return null;
}

function wpColor(i, total) {
  if (i === 0) return '#22c55e';
  if (i === total - 1) return '#ef4444';
  return '#FF6F00';
}

const STOP_ICON = { fuel: '\u26fd', food: '\ud83c\udf7b' };

function DraggableWaypointMarker({ waypoint, index, total, onDragEnd }) {
  const map = useMapInstance();
  const markerRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    const color = wpColor(index, total);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><circle cx="17" cy="17" r="14" fill="${color}" stroke="white" stroke-width="3"/><text x="17" y="22" font-size="14" font-weight="800" fill="white" text-anchor="middle" font-family="Inter,Arial,sans-serif">${index + 1}</text></svg>`;
    const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

    const el = document.createElement('div');
    el.style.cssText = 'width:34px;height:34px;pointer-events:auto;cursor:grab;';
    const img = document.createElement('img');
    img.src = iconUrl;
    img.style.cssText = 'width:34px;height:34px;';
    img.draggable = false;
    el.appendChild(img);

    const marker = new maplibregl.Marker({ element: el, anchor: 'center', draggable: true })
      .setLngLat([waypoint.lng, waypoint.lat])
      .addTo(map);
    marker.on('dragend', () => {
      const ll = marker.getLngLat();
      onDragEnd?.(index, { lat: ll.lat, lng: ll.lng });
    });
    markerRef.current = marker;

    return () => { marker.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Update position when waypoint changes (but not from drag)
  useEffect(() => {
    if (markerRef.current && waypoint) {
      markerRef.current.setLngLat([waypoint.lng, waypoint.lat]);
    }
  }, [waypoint.lat, waypoint.lng]);

  return null;
}

export default function RidePlannerMap({ waypoints = [], routeData = null, routeLoading = false, suggestedStops = [], onWaypointDrag }) {
  const center = waypoints[0] ? [waypoints[0].lat, waypoints[0].lng] : SA_CENTER;
  const path = routeData?.coordinates?.length ? routeData.coordinates : waypoints.map((w) => [w.lat, w.lng]);

  return (
    <div className="relative h-72 w-full overflow-hidden rounded-2xl border border-border bg-card">
      <MapLibreContainer center={center} zoom={6} layer="standard">
        <FitWaypoints waypoints={waypoints} />
        {path.length > 1 && (
          <>
            <MapLibreLine id="planner-casing" coordinates={path} color="#ffffff" width={8} opacity={0.9} />
            <MapLibreLine id="planner-route" coordinates={path} color="#FF6F00" width={5} opacity={1} />
          </>
        )}
        {waypoints.map((w, i) => (
          <DraggableWaypointMarker
            key={`wp-${i}`}
            waypoint={w}
            index={i}
            total={waypoints.length}
            onDragEnd={onWaypointDrag}
          />
        ))}
        {suggestedStops.map((s) => (
          <CustomMapMarker key={`sug-${s.key}`} position={[s.lat, s.lng]} zIndex={50}>
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
              {STOP_ICON[s.type] || '\ud83d\udccd'}
            </div>
          </CustomMapMarker>
        ))}
      </MapLibreContainer>
      {routeLoading && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-black/75 px-3 py-1.5 text-xs font-semibold text-white">
          Calculating route{'\u2026'}
        </div>
      )}
    </div>
  );
}