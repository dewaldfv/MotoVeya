import { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getEventMarkerUrl } from '@/lib/eventMarkers';
import { MAP_LAYERS, getLayerBackground } from '@/lib/mapLayers';
import RiderMarker from '@/components/RiderMarker';
import ServiceMarkers from '@/components/ServiceMarkers';
import FriendMarkers from '@/components/FriendMarkers';
import GroupRiderMarkers from '@/components/GroupRiderMarkers';

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

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const resize = () => map.invalidateSize();
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(map.getContainer());
    window.addEventListener('resize', resize);
    const onOrient = () => setTimeout(resize, 300);
    window.addEventListener('orientationchange', onOrient);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', onOrient);
    };
  }, [map]);
  return null;
}

function Recenter({ center, zoom, signal }) {
  const map = useMap();
  const firstRef = useRef(true);
  useEffect(() => {
    if (!center) return;
    if (firstRef.current) {
      map.setView(center, zoom ?? map.getZoom(), { animate: false });
      firstRef.current = false;
    } else if (signal > 0) {
      map.flyTo(center, zoom ?? map.getZoom());
    }
  }, [center?.[0], center?.[1], signal, map, zoom]);
  return null;
}

function FitRoute({ route, signal }) {
  const map = useMap();
  useEffect(() => {
    if (signal > 0 && route && route.length > 1) {
      const bounds = L.latLngBounds(route);
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [signal, map, route]);
  return null;
}

function NavCamera({ userPos, heading, speed, nextManeuverDistance, recenterToken, headingUp }) {
  const map = useMap();
  const failCountRef = useRef(0);
  const targetZoom = useMemo(() => {
    if (nextManeuverDistance != null && nextManeuverDistance < 200) return 17;
    if (speed > 80) return 14;
    if (speed > 40) return 16;
    return 16;
  }, [speed, nextManeuverDistance]);

  useEffect(() => {
    map.dragging?.disable();
    map.touchZoom?.disable();
    map.doubleClickZoom?.disable();
    return () => {
      map.dragging?.enable();
      map.touchZoom?.enable();
      map.doubleClickZoom?.enable();
    };
  }, [map]);

  useEffect(() => {
    if (!userPos) return;
    try {
      if (headingUp && heading != null && !isNaN(heading)) {
        const headingRad = (heading * Math.PI) / 180;
        const size = map.getSize();
        if (!size.x || !size.y) throw new Error('no size');
        const offsetPx = size.y * 0.30;
        const riderPoint = map.project(userPos, targetZoom);
        const dx = offsetPx * Math.sin(headingRad);
        const dy = -offsetPx * Math.cos(headingRad);
        const centerPoint = L.point(riderPoint.x + dx, riderPoint.y + dy);
        const newCenter = map.unproject(centerPoint, targetZoom);
        map.setView(newCenter, targetZoom, { animate: true, duration: 1.0, easeLinearity: 0.5 });
      } else {
        map.setView(userPos, targetZoom, { animate: true, duration: 0.5 });
      }
      failCountRef.current = 0;
    } catch (e) {
      failCountRef.current++;
      if (failCountRef.current >= 2) {
        map.setView(userPos, targetZoom, { animate: false });
        failCountRef.current = 0;
      }
    }
  }, [userPos, heading, targetZoom, map, recenterToken, headingUp]);

  return null;
}

function destinationIcon(rot = null) {
  const angle = rot != null ? -45 + rot : -45;
  return L.divIcon({
    html: `<div style="width:28px;height:28px;background:#4285F4;border-radius:50% 50% 50% 0;transform:rotate(${angle}deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>`,
    className: 'custom-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 26],
  });
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
  onMarkerClick,
  services = [],
  showServices = false,
  onServiceClick,
  friends = [],
  showFriends = false,
  onFriendClick,
  groupRiders = [],
  userPos = null,
  className = '',
  navActive = false,
  heading = null,
  headingUp = true,
  speed = 0,
  nextManeuverDistance = null,
  completedRoute = null,
  remainingRoute = null,
  destination = null,
}) {
  const validPois = pois.filter((p) => isValid(p.lat, p.lng));
  const validEvents = events.filter((e) => isValid(e.lat, e.lng));
  const validDistress = distressAlerts.filter((d) => isValid(d.lat, d.lng));
  const validRiders = riders.filter((r) => isValid(r.lat, r.lng));
  const bgColor = getLayerBackground(layer);
  const rotating = navActive && heading != null && !isNaN(heading) && headingUp;
  const navRot = rotating ? `${-heading}deg` : '0deg';

  return (
    <div
      className={`absolute inset-0 z-0 ${rotating ? 'nav-map-heading-up' : ''} ${className}`}
      style={{ background: bgColor, '--nav-rot': navRot }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        className="absolute inset-0 h-full w-full"
        zoomControl={false}
        scrollWheelZoom
      >
        <MapTileLayers layer={layer} />
        <MapResizer />
        {navActive ? (
          <NavCamera
            userPos={userPos || center}
            heading={heading}
            speed={speed}
            nextManeuverDistance={nextManeuverDistance}
            recenterToken={recenterSignal}
            headingUp={headingUp}
          />
        ) : (
          <>
            <Recenter center={center} zoom={zoom} signal={recenterSignal} />
            <FitRoute route={route} signal={fitRouteSignal} />
          </>
        )}

        {navActive && completedRoute && completedRoute.length > 1 && (
          <>
            <Polyline positions={completedRoute} pathOptions={{ color: '#ffffff', weight: 11, opacity: 0.9, lineCap: 'round' }} />
            <Polyline positions={completedRoute} pathOptions={{ color: '#9aa0a6', weight: 7, opacity: 0.7, lineCap: 'round' }} />
          </>
        )}
        {navActive && remainingRoute && remainingRoute.length > 1 && (
          <>
            <Polyline positions={remainingRoute} pathOptions={{ color: '#ffffff', weight: 11, opacity: 1, lineCap: 'round' }} />
            <Polyline positions={remainingRoute} pathOptions={{ color: '#2D7FF9', weight: 7, opacity: 1, lineCap: 'round' }} />
          </>
        )}
        {!navActive && route && route.length > 0 && (
          <Polyline positions={route} pathOptions={{ color: '#FF6F00', weight: 5, opacity: 0.85 }} />
        )}

        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={destinationIcon(rotating ? heading : null)} />
        )}

        {validPois.map((poi) => (
          <Marker key={`poi-${poi.id}`} position={[poi.lat, poi.lng]} icon={createIcon(poi.category)} eventHandlers={{ click: () => onMarkerClick?.(poi) }} />
        ))}
        {validEvents.map((ev) => (
          <Marker key={`event-${ev.id}`} position={[ev.lat, ev.lng]} icon={getEventIcon(ev)} eventHandlers={{ click: () => onMarkerClick?.(ev) }} />
        ))}
        {validDistress.map((d) => (
          <Marker key={`distress-${d.id}`} position={[d.lat, d.lng]} icon={createIcon('distress')} />
        ))}
        {validRiders.map((r) => (
          <RiderMarker key={`rider-${r.id}`} position={[r.lat, r.lng]} heading={r.heading} accuracy={r.accuracy} zIndex={1200} />
        ))}
        {showServices && (
          <ServiceMarkers services={services} userPos={userPos} onMarkerClick={onServiceClick} />
        )}
        {showFriends && (
          <FriendMarkers friends={friends} onSelect={onFriendClick} />
        )}
        {groupRiders.length > 0 && (
          <GroupRiderMarkers participants={groupRiders} />
        )}
      </MapContainer>
    </div>
  );
}