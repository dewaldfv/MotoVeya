import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getEventMarkerUrl } from '@/lib/eventMarkers';

const CATEGORY_CONFIG = {
  fuel: { color: '#22c55e', emoji: '⛽' },
  food: { color: '#f59e0b', emoji: '🍽️' },
  pub: { color: '#a855f7', emoji: '🍺' },
  workshop: { color: '#3b82f6', emoji: '🔧' },
  dealership: { color: '#06b6d4', emoji: '🏍️' },
  emergency: { color: '#ef4444', emoji: '🏥' },
  rest_stop: { color: '#94a3b8', emoji: '🅿️' },
  scenic: { color: '#10b981', emoji: '🏔️' },
  accommodation: { color: '#8b5cf6', emoji: '🏨' },
  atm: { color: '#facc15', emoji: '💳' },
  event: { color: '#FF6F00', emoji: '🏁' },
  distress: { color: '#ef4444', emoji: '🆘' },
};

function createIcon(category) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.rest_stop;
  return L.divIcon({
    html: `<div style="width:36px;height:36px;background:${config.color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:16px;">${config.emoji}</span></div>`,
    className: 'custom-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 34],
    popupAnchor: [0, -34],
  });
}

const eventIconCache = {};
function getEventIcon(ev) {
  const url = ev.markerIcon || getEventMarkerUrl(ev.category);
  if (!eventIconCache[url]) {
    eventIconCache[url] = L.icon({
      iconUrl: url,
      iconSize: [48, 48],
      iconAnchor: [24, 48],
      popupAnchor: [0, -48],
    });
  }
  return eventIconCache[url];
}

function Recenter({ center, zoom, signal }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom ?? map.getZoom());
  }, [center?.[0], center?.[1], zoom, signal, map]);
  return null;
}

export default function MapView({
  center = [-26.2041, 28.0473],
  zoom = 12,
  pois = [],
  events = [],
  riders = [],
  distressAlerts = [],
  route = null,
  recenterSignal = 0,
  onMarkerClick,
  className = '',
}) {
  return (
    <MapContainer center={center} zoom={zoom} className={className} zoomControl={false} scrollWheelZoom>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap &copy; CARTO'
      />
      <Recenter center={center} zoom={zoom} signal={recenterSignal} />
      {route && route.length > 0 && (
        <Polyline positions={route} pathOptions={{ color: '#FF6F00', weight: 5, opacity: 0.85 }} />
      )}
      {pois.map((poi) => (
        <Marker
          key={`poi-${poi.id}`}
          position={[poi.lat, poi.lng]}
          icon={createIcon(poi.category)}
          eventHandlers={{ click: () => onMarkerClick?.(poi) }}
        />
      ))}
      {events.map((ev) => (
        <Marker
          key={`event-${ev.id}`}
          position={[ev.lat, ev.lng]}
          icon={getEventIcon(ev)}
          eventHandlers={{ click: () => onMarkerClick?.(ev) }}
        />
      ))}
      {distressAlerts.map((d) => (
        <Marker key={`distress-${d.id}`} position={[d.lat, d.lng]} icon={createIcon('distress')} />
      ))}
      {riders.map((r) => (
        <CircleMarker
          key={`rider-${r.id}`}
          center={[r.lat, r.lng]}
          radius={10}
          pathOptions={{ color: '#FF6F00', fillColor: '#FF6F00', fillOpacity: 0.8 }}
        />
      ))}
    </MapContainer>
  );
}