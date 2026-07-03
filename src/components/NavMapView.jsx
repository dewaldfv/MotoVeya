import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import RiderMarker from './RiderMarker';

const VOYAGER_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const DARK_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ATTR = '&copy; OpenStreetMap &copy; CARTO';

function destinationIcon() {
  return L.divIcon({
    html: `<div style="width:28px;height:28px;background:#4285F4;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>`,
    className: 'custom-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 26],
  });
}

function NavCamera({ userPos, heading, active, speed, nextManeuverDistance, route }) {
  const map = useMap();
  const containerRef = useRef(null);

  useEffect(() => { containerRef.current = map.getContainer(); }, [map]);

  const targetZoom = useMemo(() => {
    if (!active) return 13;
    if (nextManeuverDistance != null && nextManeuverDistance < 200) return 17;
    if (speed > 80) return 14;
    if (speed > 40) return 16;
    return 16;
  }, [active, speed, nextManeuverDistance]);

  useEffect(() => {
    if (active) {
      map.dragging?.disable();
      map.touchZoom?.disable();
      map.doubleClickZoom?.disable();
    } else {
      map.dragging?.enable();
      map.touchZoom?.enable();
      map.doubleClickZoom?.enable();
    }
  }, [active, map]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (active && heading != null && !isNaN(heading)) {
      el.style.transition = 'transform 0.3s ease-out';
      el.style.transformOrigin = 'center 70%';
      el.style.willChange = 'transform';
      el.style.transform = `perspective(750px) rotateZ(${-heading}deg) rotateX(30deg)`;
    } else {
      el.style.transition = 'transform 0.3s ease-out';
      el.style.transform = '';
      el.style.transformOrigin = '';
      el.style.willChange = '';
    }
  }, [heading, active]);

  useEffect(() => {
    if (!userPos) return;
    if (active && heading != null && !isNaN(heading)) {
      const headingRad = (heading * Math.PI) / 180;
      const size = map.getSize();
      const offsetPx = size.y * 0.22;
      const riderPoint = map.project(userPos, targetZoom);
      const dx = offsetPx * Math.sin(headingRad);
      const dy = -offsetPx * Math.cos(headingRad);
      const centerPoint = L.point(riderPoint.x + dx, riderPoint.y + dy);
      const newCenter = map.unproject(centerPoint, targetZoom);
      map.setView(newCenter, targetZoom, { animate: true, duration: 1.0, easeLinearity: 0.5 });
    } else if (!active && route && route.length > 1) {
      map.fitBounds(L.latLngBounds(route), { padding: [80, 80], animate: true });
    } else {
      map.setView(userPos, targetZoom, { animate: true, duration: 0.5 });
    }
  }, [userPos, heading, active, targetZoom, route, map]);

  return null;
}

export default function NavMapView({
  userPos = null,
  heading = null,
  accuracy = null,
  active = false,
  speed = 0,
  nextManeuverDistance = null,
  remainingRoute = null,
  completedRoute = null,
  destination = null,
  layer = 'standard',
}) {
  const tileUrl = layer === 'satellite' ? SATELLITE_URL : layer === 'dark' ? DARK_URL : VOYAGER_URL;
  const tileAttr = layer === 'satellite' ? '&copy; Esri' : ATTR;
  const bgColor = layer === 'satellite' ? '#1a1a1a' : layer === 'dark' ? '#0a0a0a' : '#e8eaed';

  return (
    <MapContainer
      center={userPos || [-26.2041, 28.0473]}
      zoom={14}
      zoomControl={false}
      scrollWheelZoom={false}
      className="absolute inset-0 z-0 h-full w-full"
      style={{ background: bgColor }}
    >
      <TileLayer url={tileUrl} attribution={tileAttr} />
      <NavCamera
        userPos={userPos}
        heading={heading}
        active={active}
        speed={speed}
        nextManeuverDistance={nextManeuverDistance}
        route={remainingRoute}
      />
      {completedRoute && completedRoute.length > 1 && (
        <Polyline positions={completedRoute} pathOptions={{ color: '#9aa0a6', weight: 7, opacity: 0.7, lineCap: 'round' }} />
      )}
      {remainingRoute && remainingRoute.length > 1 && (
        <Polyline positions={remainingRoute} pathOptions={{ color: '#4285F4', weight: 7, opacity: 1, lineCap: 'round' }} />
      )}
      {destination && (
        <Marker position={[destination.lat, destination.lng]} icon={destinationIcon()} />
      )}
      {userPos && (
        <RiderMarker position={userPos} heading={heading} accuracy={accuracy} />
      )}
    </MapContainer>
  );
}