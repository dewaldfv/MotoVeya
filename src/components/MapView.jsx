/* global google */
import { useEffect, useState, useRef, useMemo } from 'react';
import { GoogleMap, Polyline, InfoWindow, useGoogleMap } from '@react-google-maps/api';
import { useGoogleMapsLoaded } from '@/lib/googleMapsLoader';
import { MAP_LAYERS, getLayerStyles, getLayerBackground, getMapOptions } from '@/lib/mapLayers';
import CustomMapMarker from './CustomMapMarker';
import ServiceMarkers from './ServiceMarkers';
import LiveMarkers from './map/LiveMarkers';
import NativeEventMarkers from './map/NativeEventMarkers';
import MapPopupContent from './MapPopupContent';
import { useMapCamera } from '@/hooks/useMapCamera';

const SA_CENTER = [-26.2041, 28.0473];

const CATEGORY_CONFIG = {
  fuel: { color: '#22c55e', emoji: '⛽' },
  food: { color: '#f59e0b', emoji: '🍽️' },
  pub: { color: '#a855f7', emoji: '🍺' },
  workshop: { color: '#3b82f6', emoji: '🔧' },
  dealership: { color: '#06b6d4', emoji: '🏍️' },
  emergency: { color: '#ef4444', emoji: '⚕️' },
  rest_stop: { color: '#94a3b8', emoji: '🅿️' },
  scenic: { color: '#10b981', emoji: '🏔️' },
  accommodation: { color: '#8b5cf6', emoji: '🛏️' },
  atm: { color: '#facc15', emoji: '💳' },
  event: { color: '#FF6F00', emoji: '🏁' },
  distress: { color: '#ef4444', emoji: '🆘' },
};

function PoiVisual({ category }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.rest_stop;
  return (
    <div style={{ width: 36, height: 36, background: config.color, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', border: '2px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ transform: 'rotate(45deg)', fontSize: 16 }}>{config.emoji}</span>
    </div>
  );
}

function LayerController({ layer }) {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map) return;
    const config = MAP_LAYERS.find((l) => l.key === layer) || MAP_LAYERS[0];
    map.setMapTypeId(config.mapTypeId);
    map.setOptions({ styles: getLayerStyles(layer) });
  }, [map, layer]);
  return null;
}

function MapResizer() {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map) return;
    const resize = () => google.maps.event.trigger(map, 'resize');
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(map.getDiv());
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

// Tracks the map's live zoom level so static marker layers can be gated by zoom
// (services are only shown once the user zooms in close enough to avoid clutter).
function ZoomTracker({ onZoom }) {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map) return;
    const emit = () => onZoom(map.getZoom());
    emit();
    const listener = map.addListener('zoom_changed', emit);
    return () => google.maps.event.removeListener(listener);
  }, [map, onZoom]);
  return null;
}

function LocationLock({ center, locked, zoom }) {
  const map = useGoogleMap();
  const previousCenterRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    map.setOptions({
      draggable: !locked,
      scrollwheel: !locked,
      disableDoubleClickZoom: locked,
      gestureHandling: locked ? 'none' : 'auto',
    });
  }, [map, locked]);

  useEffect(() => {
    if (!map || !locked || !center) return;
    const pos = { lat: center[0], lng: center[1] };
    const previous = previousCenterRef.current;
    const changed = !previous || previous.lat !== pos.lat || previous.lng !== pos.lng;
    if (changed) {
      map.panTo(pos);
      if (zoom != null && !previous) map.setZoom(zoom);
    }
    previousCenterRef.current = pos;
  }, [map, locked, center?.[0], center?.[1], zoom]);

  useEffect(() => {
    if (!map || !locked || !center) return;
    map.panTo({ lat: center[0], lng: center[1] });
  }, [map, locked]);

  return null;
}

function Recenter({ center, zoom, signal }) {
  const map = useGoogleMap();
  const firstRef = useRef(true);

  useEffect(() => {
    if (!map || !center) return;
    const pos = { lat: center[0], lng: center[1] };
    if (firstRef.current) {
      map.setCenter(pos);
      if (zoom != null) map.setZoom(zoom);
      firstRef.current = false;
    } else if (signal > 0) {
      // Manual "My Location" — snap immediately.
      map.panTo(pos);
    }
  }, [center?.[0], center?.[1], signal, map, zoom]);
  return null;
}

function FitRoute({ route, signal }) {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map || signal <= 0 || !route || route.length < 2) return;
    const bounds = new google.maps.LatLngBounds();
    route.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
    map.fitBounds(bounds, 60);
  }, [signal, map, route]);
  return null;
}

function NavCamera({ userPos, heading, speed, nextManeuverDistance, recenterToken, headingUp }) {
  const map = useGoogleMap();
  useMapCamera({ map, userPos, heading, headingUp, speed, nextManeuverDistance, recenterToken });
  return null;
}

const isValid = (lat, lng) =>
  lat != null && lng != null && !isNaN(lat) && !isNaN(lng) &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

function toLatLngPath(coords) {
  return (coords || []).map(([lat, lng]) => ({ lat, lng }));
}

export default function MapView({
  center = SA_CENTER,
  zoom = 12,
  pois = [],
  events = [],
  riders = [],
  distressAlerts = [],
  routeWarnings = [],
  route = null,
  recenterSignal = 0,
  fitRouteSignal = 0,
  locationLocked = false,
  layer = 'dark',
  onMarkerClick,
  onSavePin,
  onNavigatePin,
  services = [],
  showServices = false,
  onServiceClick,
  friends = [],
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
  favoriteEventIds = null,
}) {
  const isLoaded = useGoogleMapsLoaded();
  const [popupItem, setPopupItem] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(zoom);
  const bgColor = getLayerBackground(layer);
  // Services and Food & Drink should be visible at normal city-level zoom.
  // ServiceMarkers applies its own proximity filtering and clustering.
  const SERVICE_MIN_ZOOM = 13;
  const rotating = navActive && heading != null && !isNaN(heading) && headingUp;
  const navRot = rotating ? `${-heading}deg` : '0deg';
  const initialCenterRef = useRef(null);
  if (!initialCenterRef.current) {
    initialCenterRef.current = { lat: center[0], lng: center[1] };
  }

  // Coarsen the user position to ~1.1km buckets so the service proximity filter only
  // recomputes when the rider actually crosses a bucket boundary — not on every GPS tick.
  const coarseUserPos = useMemo(() => {
    if (!userPos) return null;
    return [Math.round(userPos[0] * 100) / 100, Math.round(userPos[1] * 100) / 100];
  }, [userPos?.[0], userPos?.[1]]);

  // Static pins (POIs, events, distress, services) stay as memoized React overlays —
  // their positions never change, so they only render once.
  const poiMarkers = useMemo(
    () => pois.filter((p) => isValid(p.lat, p.lng)).map((poi) => (
      <CustomMapMarker key={`poi-${poi.id}`} position={[poi.lat, poi.lng]} onClick={() => setPopupItem(poi)} zIndex={200} pane="overlayLayer">
        <PoiVisual category={poi.category} />
      </CustomMapMarker>
    )),
    [pois]
  );
  const distressMarkers = useMemo(
    () => distressAlerts.filter((d) => isValid(d.lat, d.lng)).map((d) => (
      <CustomMapMarker key={`distress-${d.id}`} position={[d.lat, d.lng]} onClick={() => setPopupItem(d)}>
        <PoiVisual category="distress" />
      </CustomMapMarker>
    )),
    [distressAlerts]
  );
  const warningMarkers = useMemo(
    () => routeWarnings.filter((w) => isValid(w.lat, w.lng)).map((w) => (
      <CustomMapMarker key={`warning-${w.id}`} position={[w.lat, w.lng]} onClick={() => setPopupItem({ ...w, category: 'warning', name: w.title, description: w.message })}>
        <div style={{ width: 38, height: 38, background: '#f59e0b', borderRadius: '50%', border: '3px solid white', boxShadow: '0 3px 12px rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚠️</div>
      </CustomMapMarker>
    )),
    [routeWarnings]
  );
  // POI markers are intentionally hidden at broad map zooms to keep the Home map clean.
  // In Ride Mode they are always visible; otherwise they appear only once the rider
  // zooms past level 12 (13+). Safety warnings/distress remain independent of this gate.
  const poiMarkersVisible = navActive || zoomLevel > 12;
  const servicesVisible = showServices && poiMarkersVisible;
  const serviceMarkers = useMemo(
    () => servicesVisible ? (
      <ServiceMarkers services={services} userPos={coarseUserPos} onMarkerClick={onServiceClick || setPopupItem} />
    ) : null,
    [servicesVisible, services, coarseUserPos, onServiceClick]
  );

  if (!isLoaded) {
    return <div className={`absolute inset-0 ${className}`} style={{ background: bgColor }} />;
  }

  return (
    <div
      className={`absolute inset-0 z-0 ${rotating ? 'nav-map-heading-up' : ''} ${className}`}
      style={{ background: bgColor, '--nav-rot': navRot }}
    >
      <GoogleMap
        mapContainerClassName={`absolute inset-0 h-full w-full ${rotating ? 'gm-rotatable' : ''}`}
        center={initialCenterRef.current}
        zoom={zoom}
        options={getMapOptions(layer)}
      >
        <LayerController layer={layer} />
        <MapResizer />
        <ZoomTracker onZoom={setZoomLevel} />

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
            <LocationLock center={center} locked={locationLocked} zoom={zoom} />
            {!locationLocked && <Recenter center={center} zoom={zoom} signal={recenterSignal} />}
            <FitRoute route={route} signal={fitRouteSignal} />
          </>
        )}

        {navActive && completedRoute && completedRoute.length > 1 && (
          <>
            <Polyline path={toLatLngPath(completedRoute)} options={{ strokeColor: '#ffffff', strokeWeight: 11, strokeOpacity: 0.9 }} />
            <Polyline path={toLatLngPath(completedRoute)} options={{ strokeColor: '#9aa0a6', strokeWeight: 7, strokeOpacity: 0.7 }} />
          </>
        )}
        {navActive && remainingRoute && remainingRoute.length > 1 && (
          <>
            <Polyline path={toLatLngPath(remainingRoute)} options={{ strokeColor: '#ffffff', strokeWeight: 11, strokeOpacity: 1 }} />
            <Polyline path={toLatLngPath(remainingRoute)} options={{ strokeColor: '#2D7FF9', strokeWeight: 7, strokeOpacity: 1 }} />
          </>
        )}
        {!navActive && route && route.length > 1 && (
          <Polyline path={toLatLngPath(route)} options={{ strokeColor: '#FF6F00', strokeWeight: 5, strokeOpacity: 0.85 }} />
        )}

        {destination && (
          <CustomMapMarker position={[destination.lat, destination.lng]} anchor="bottom">
            <div style={{ width: 28, height: 28, background: '#4285F4', borderRadius: '50% 50% 50% 0', transform: `rotate(${rotating && heading != null ? -45 + heading : -45}deg)`, border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }} />
          </CustomMapMarker>
        )}

        {poiMarkersVisible && poiMarkers}

        <NativeEventMarkers
          events={events}
          favoriteEventIds={favoriteEventIds}
          onEventClick={setPopupItem}
        />

        {distressMarkers}
        {warningMarkers}

        {serviceMarkers}

        <LiveMarkers
          rider={riders[0] || null}
          friends={friends}
          groupRiders={groupRiders}
          onFriendClick={onFriendClick}
        />

        {popupItem && (
          <InfoWindow position={{ lat: popupItem.lat, lng: popupItem.lng }} onCloseClick={() => setPopupItem(null)} zIndex={99999} options={{ zIndex: 99999 }}>
            <MapPopupContent
              item={popupItem}
              onMoreInfo={() => { onMarkerClick?.(popupItem); setPopupItem(null); }}
              onSave={() => { onSavePin?.(popupItem); setPopupItem(null); }}
              onNavigate={() => { onNavigatePin?.(popupItem); setPopupItem(null); }}
            />
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}