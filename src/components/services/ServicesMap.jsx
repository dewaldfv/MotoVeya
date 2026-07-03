import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getCategoryConfig } from '@/lib/serviceCategories';
import { MAP_LAYERS } from '@/lib/mapLayers';
import RiderMarker from '@/components/RiderMarker';

function createServiceIcon(category) {
  const config = getCategoryConfig(category);
  return L.divIcon({
    html: `<div style="width:36px;height:36px;background:${config.color};border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:18px;">${config.icon}</div>`,
    className: 'custom-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function createClusterIcon(count) {
  return L.divIcon({
    html: `<div style="width:44px;height:44px;background:#FF6A00;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:16px;">${count}</div>`,
    className: 'custom-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function ZoomTracker({ onZoom }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => onZoom(map.getZoom());
    map.on('zoomend', handler);
    return () => map.off('zoomend', handler);
  }, [map, onZoom]);
  return null;
}

function FitBounds({ services, userPos, trigger }) {
  const map = useMap();
  useEffect(() => {
    if (trigger > 0 && services.length > 0) {
      const points = [...services.map((s) => [s.lat, s.lng])];
      if (userPos) points.push(userPos);
      if (points.length === 1) map.setView(points[0], 14);
      else map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 15 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  return null;
}

export default function ServicesMap({ services, userPos, onSelect, fitTrigger = 0 }) {
  const [zoom, setZoom] = useState(13);

  const markers = useMemo(() => {
    if (zoom > 12) return services.map((s) => ({ type: 'single', service: s }));
    const groups = {};
    services.forEach((s) => {
      const key = `${s.lat.toFixed(2)},${s.lng.toFixed(2)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return Object.values(groups).map((group) => {
      if (group.length === 1) return { type: 'single', service: group[0] };
      const lat = group.reduce((s, i) => s + i.lat, 0) / group.length;
      const lng = group.reduce((s, i) => s + i.lng, 0) / group.length;
      return { type: 'cluster', count: group.length, lat, lng };
    });
  }, [services, zoom]);

  const config = MAP_LAYERS.find((l) => l.key === 'standard') || MAP_LAYERS[0];

  return (
    <MapContainer center={userPos || [-26.2041, 28.0473]} zoom={13} className="h-full w-full" zoomControl={false} scrollWheelZoom>
      {config.tiles.map((t, i) => (
        <TileLayer key={i} url={t.url} attribution={t.attribution} />
      ))}
      <ZoomTracker onZoom={setZoom} />
      <FitBounds services={services} userPos={userPos} trigger={fitTrigger} />
      {userPos && <RiderMarker position={userPos} />}
      {markers.map((m, i) =>
        m.type === 'cluster' ? (
          <Marker key={`c-${i}`} position={[m.lat, m.lng]} icon={createClusterIcon(m.count)} />
        ) : (
          <Marker
            key={m.service.id}
            position={[m.service.lat, m.service.lng]}
            icon={createServiceIcon(m.service.category)}
            eventHandlers={{ click: () => onSelect(m.service) }}
          />
        )
      )}
    </MapContainer>
  );
}