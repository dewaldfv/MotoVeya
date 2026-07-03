import { useEffect, useState } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
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

const iconCache = {};
function getServiceIcon(category) {
  if (iconCache[category]) return iconCache[category];
  const cat = getServiceCategory(category);
  iconCache[category] = L.divIcon({
    html: `<div style="width:36px;height:36px;background:${cat.color};border-radius:50%;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-size:16px;">${cat.emoji}</div>`,
    className: 'custom-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
  return iconCache[category];
}

function clusterIcon(count) {
  return L.divIcon({
    html: `<div style="width:40px;height:40px;background:#FF6F00;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;color:white;">${count}</div>`,
    className: 'custom-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

export default function ServiceMarkers({ services, userPos, onMarkerClick }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => map.off('zoomend', onZoom);
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
          const s = item.service;
          return (
            <Marker key={`svc-${s.id}`} position={[s.lat, s.lng]} icon={getServiceIcon(s.category)}
              eventHandlers={{ click: () => onMarkerClick?.(s) }} />
          );
        }
        return <Marker key={`svc-cluster-${i}`} position={[item.lat, item.lng]} icon={clusterIcon(item.count)} />;
      })}
    </>
  );
}