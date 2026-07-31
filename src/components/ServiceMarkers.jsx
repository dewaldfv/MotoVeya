/* global google */
import { useEffect, useState } from 'react';
import { useGoogleMap } from '@react-google-maps/api';
import CustomMapMarker from './CustomMapMarker';
import { getServiceCategory, haversine } from '@/lib/serviceCategories';

const SERVICE_ZOOM_THRESHOLD = 13;
const SERVICE_DISTANCE_KM = 10;

function clusterServices(services, zoom) {
  const precision = zoom >= 15 ? 5 : zoom >= 14 ? 4 : 3;
  const groups = {};
  services.forEach((s) => {
    const key = `${s.lat.toFixed(precision)},${s.lng.toFixed(precision)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  return Object.values(groups).map((items) => {
    if (items.length === 1) return { type: 'single', service: items[0] };
    const avgLat = items.reduce((sum, s) => sum + s.lat, 0) / items.length;
    const avgLng = items.reduce((sum, s) => sum + s.lng, 0) / items.length;
    return { type: 'cluster', count: items.length, lat: avgLat, lng: avgLng };
  });
}

function ServicePin({ service, onClick }) {
  const cat = getServiceCategory(service.category);
  return (
    <CustomMapMarker position={[service.lat, service.lng]} onClick={onClick}>
      <div style={{ width: 36, height: 36, background: cat.color, borderRadius: '50%', border: '2px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
        {cat.emoji}
      </div>
    </CustomMapMarker>
  );
}

function ClusterPin({ count, lat, lng, onClick }) {
  return (
    <CustomMapMarker position={[lat, lng]} onClick={onClick}>
      <div style={{ width: 40, height: 40, background: '#FF6F00', borderRadius: '50%', border: '3px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 'bold', color: 'white' }}>
        {count}
      </div>
    </CustomMapMarker>
  );
}

export default function ServiceMarkers({ services, userPos, onMarkerClick }) {
  const map = useGoogleMap();
  const [zoom, setZoom] = useState(map?.getZoom() || 13);

  useEffect(() => {
    if (!map) return;
    const onZoom = () => setZoom(map.getZoom());
    const id = map.addListener('zoom_changed', onZoom);
    return () => google.maps.event.removeListener(id);
  }, [map]);

  if (zoom < SERVICE_ZOOM_THRESHOLD) return null;

  const filtered = userPos
    ? services.filter((s) => haversine(userPos[0], userPos[1], s.lat, s.lng) <= SERVICE_DISTANCE_KM)
    : services;

  const clusters = clusterServices(filtered, zoom);

  return (
    <>
      {clusters.map((item, i) => {
        if (item.type === 'single') {
          return <ServicePin key={`svc-${item.service.id}`} service={item.service} onClick={() => onMarkerClick?.(item.service)} />;
        }
        return <ClusterPin key={`svc-cluster-${i}`} count={item.count} lat={item.lat} lng={item.lng} />;
      })}
    </>
  );
}