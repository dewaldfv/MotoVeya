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

function NavCamera({ userPos, heading, active, speed, nextManeuverDistance, route }) {
  const map = useMap();
  const failCountRef = useRef(0);

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

  // Camera: north-up, pitch 0°, no CSS transforms on the container.
  // Centers the rider with an offset in the direction of travel so the
  // upcoming road is visible ahead. RiderMarker rotates to show heading.
  useEffect(() => {
    if (!userPos) return;
    try {
      if (active && heading != null && !isNaN(heading)) {
        const headingRad = (heading * Math.PI) / 180;
        const size = map.getSize();
        if (!size.x || !size.y) throw new Error('Map has no size');
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
      failCountRef.current = 0;
    } catch (e) {
      failCountRef.current++;
      if (failCountRef.current >= 2) {
        // Fallback: reset to center=rider, zoom=target, bearing=north, pitch=0
        map.setView(userPos, targetZoom, { animate: false });
        failCountRef.current = 0;
      }
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
      <MapResizer />
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