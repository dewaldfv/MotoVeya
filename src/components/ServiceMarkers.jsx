/* global google */
import { useEffect, useRef, useState, useMemo } from 'react';
import { useGoogleMap } from '@react-google-maps/api';
import { haversine, getServiceCategory } from '@/lib/serviceCategories';
import CustomMapMarker from './CustomMapMarker';

// Keep service and Food & Drink markers visible at normal city-level zoom.
// A wider radius also prevents markers from disappearing while the user's GPS
// position is still settling or when venues are just outside the immediate area.
const SERVICE_ZOOM_THRESHOLD = 11;
const SERVICE_DISTANCE_KM = 30;

function clusterServices(services, zoom) {
  const precision = zoom >= 15 ? 5 : zoom >= 14 ? 4 : 3;
  const groups = {};
  services.forEach((s) => {
    const lat = Number(s.lat);
    const lng = Number(s.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const key = `${lat.toFixed(precision)},${lng.toFixed(precision)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  return Object.values(groups).map((items) => {
    if (items.length === 1) return { type: 'single', service: items[0] };
    const avgLat = items.reduce((sum, s) => sum + Number(s.lat), 0) / items.length;
    const avgLng = items.reduce((sum, s) => sum + Number(s.lng), 0) / items.length;
    return { type: 'cluster', count: items.length, lat: avgLat, lng: avgLng };
  });
}

/**
 * ServiceMarkers — renders service pins as HTML overlays using the same
 * `.motogo-event-pin__body` teardrop style as event markers. When a service
 * has an uploaded logo_url, the logo image is clipped into the pin body;
 * otherwise the category emoji is used as a fallback. Keeps the existing
 * zoom threshold (>=13) and 10km proximity filtering for services.
 */
export default function ServiceMarkers({ services, userPos, onMarkerClick }) {
  const map = useGoogleMap();
  const [zoom, setZoom] = useState(map?.getZoom() || SERVICE_ZOOM_THRESHOLD);
  const cbRef = useRef(onMarkerClick);
  cbRef.current = onMarkerClick;

  useEffect(() => {
    if (!map) return;
    setZoom(map.getZoom());
    const onZoom = () => setZoom(map.getZoom());
    const id = map.addListener('zoom_changed', onZoom);
    return () => google.maps.event.removeListener(id);
  }, [map]);

  const items = useMemo(() => {
    if (zoom < SERVICE_ZOOM_THRESHOLD) return [];
    const filtered = services
      .filter((s) => s.lat != null && s.lng != null && Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)))
      .map((s) => ({ ...s, lat: Number(s.lat), lng: Number(s.lng) }))
      .filter((s) => !userPos || haversine(Number(userPos[0]), Number(userPos[1]), s.lat, s.lng) <= SERVICE_DISTANCE_KM);
    return clusterServices(filtered, zoom);
  }, [services, userPos, zoom]);

  return (
    <>
      {items.map((item) => {
        if (item.type === 'single') {
          const s = item.service;
          const cat = getServiceCategory(s.category);
          return (
            <CustomMapMarker
              key={`svc-${s.id}`}
              position={[s.lat, s.lng]}
              zIndex={400}
              onClick={() => cbRef.current?.(s)}
            >
              {s.logo_url ? (
                <img
                  src={s.logo_url}
                  alt={s.name}
                  style={{ width: 36, height: 36, objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <span style={{ fontSize: 28, lineHeight: 1, display: 'inline-flex' }}>{cat.emoji}</span>
              )}
            </CustomMapMarker>
          );
        }
        return (
          <CustomMapMarker
            key={`svc-cluster-${item.lat}-${item.lng}`}
            position={[item.lat, item.lng]}
            zIndex={400}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#FF6F00',
                border: '3px solid #fff',
                boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: 16,
              }}
            >
              {item.count}
            </div>
          </CustomMapMarker>
        );
      })}
    </>
  );
}