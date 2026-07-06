import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getEventMarkerUrl } from '@/lib/eventMarkers';
import { MAP_LAYERS } from '@/lib/mapLayers';
import RiderMarker from '@/components/RiderMarker';
import ServiceMarkers from '@/components/ServiceMarkers';
import FriendMarkers from '@/components/FriendMarkers';

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
    eventIconCache[url] = L.divIcon({
      html: `<div style="width:44px;height:44px;border-radius:50%;overflow:hidden;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);"><img src="${url}" style="width:100%;height:100%;object-fit:cover;" /></div>`,
      className: 'custom-marker',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22],
    });
  }
  return eventIconCache[url];
}

function MapTileLayers({ layer }) {
  const map = useMap();
  const [effective, setEffective] = useState(layer);
  const errorCount = useRef(0);

  useEffect(() => {
    setEffective(layer);
    errorCount.current = 0;
  }, [layer]);

  useEffect(() => {
    const onTileError = () => {
      errorCount.current += 1;
      if (errorCount.current > 8 && effective !== 'standard') {
        setEffective('standard');
      }
    };
    map.on('tileerror', onTileError);
    return () => map.off('tileerror', onTileError);
  }, [map, effective]);

  const config = MAP_LAYERS.find((l) => l.key === effective) || MAP_LAYERS[0];
  return config.tiles.map((t, i) => (
    <TileLayer key={`${effective}-${i}`} url={t.url} attribution={t.attribution} />
  ));
}

function Recenter({ center, zoom, signal }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom ?? map.getZoom());
  }, [center?.[0], center?.[1], zoom, signal, map]);
  return null;
}

function FitRoute({ route, signal }) {
  const map = useMap();
  useEffect(() => {
    if (signal > 0 && route && route.length > 1) {
      const bounds = L.latLngBounds(route);
      map.fitBounds(bounds, { padding: [60, 60] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal, map]);
  return null;
}

const isValid = (lat, lng) =>
  lat != null && lng != null && !isNaN(lat) && !isNaN(lng) &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

export default function MapView({
  center = [-26.2041, 28.0473],
  zoom = 12,
  pois = [],
  events = [],
  riders = [],
  distressAlerts = [],
  route = null,
  recenterSignal = 0,
  fitRouteSignal = 0,
  layer = 'dark',
  followRider = false,
  onMarkerClick,
  services = [],
  showServices = false,
  onServiceClick,
  friends = [],
  showFriends = false,
  onFriendClick,
  userPos = null,
  className = '',
}) {
  const validPois = pois.filter((p) => isValid(p.lat, p.lng));
  const validEvents = events.filter((e) => isValid(e.lat, e.lng));
  const validDistress = distressAlerts.filter((d) => isValid(d.lat, d.lng));
  const validRiders = riders.filter((r) => isValid(r.lat, r.lng));
  return (
    <MapContainer center={center} zoom={zoom} className={className} zoomControl={false} scrollWheelZoom>
      <MapTileLayers layer={layer} />
      <Recenter center={center} zoom={zoom} signal={recenterSignal} />
      <FitRoute route={route} signal={fitRouteSignal} />
      {route && route.length > 0 && (
        <Polyline positions={route} pathOptions={{ color: '#FF6F00', weight: 5, opacity: 0.85 }} />
      )}
      {validPois.map((poi) => (
        <Marker
          key={`poi-${poi.id}`}
          position={[poi.lat, poi.lng]}
          icon={createIcon(poi.category)}
          eventHandlers={{ click: () => onMarkerClick?.(poi) }}
        />
      ))}
      {validEvents.map((ev) => (
        <Marker
          key={`event-${ev.id}`}
          position={[ev.lat, ev.lng]}
          icon={getEventIcon(ev)}
          eventHandlers={{ click: () => onMarkerClick?.(ev) }}
        />
      ))}
      {validDistress.map((d) => (
        <Marker key={`distress-${d.id}`} position={[d.lat, d.lng]} icon={createIcon('distress')} />
      ))}
      {validRiders.map((r) => (
        <RiderMarker
          key={`rider-${r.id}`}
          position={[r.lat, r.lng]}
          heading={r.heading}
          accuracy={r.accuracy}
          zIndex={1200}
        />
      ))}
      {showServices && (
        <ServiceMarkers services={services} userPos={userPos} onMarkerClick={onServiceClick} />
      )}
      {showFriends && (
        <FriendMarkers friends={friends} onSelect={onFriendClick} />
      )}
    </MapContainer>
  );
}