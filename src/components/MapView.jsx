import { useEffect, useState, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import MapLibreContainer from './MapLibreContainer';
import MapLibreLine from './MapLibreLine';
import MapLibreCircle from './MapLibreCircle';
import MapLibrePopup from './MapLibrePopup';
import { useMapInstance } from '@/lib/maplibreContext';
import { useMapLibreCamera } from '@/hooks/useMapLibreCamera';
import { getLayerBackground } from '@/lib/mapLayers';
import CustomMapMarker from './CustomMapMarker';
import ServiceMarkers from './ServiceMarkers';
import FuelStationMarkers from './FuelStationMarkers';
import LiveMarkers from './map/LiveMarkers';
import NativeEventMarkers from './map/NativeEventMarkers';
import MapPopupContent from './MapPopupContent';

const SA_CENTER = [-26.2041, 28.0473];

const CATEGORY_CONFIG = {
  fuel: { color: '#22c55e', emoji: '\u26fd' },
  food: { color: '#f59e0b', emoji: '\ud83c\udf7d\ufe0f' },
  pub: { color: '#a855f7', emoji: '\ud83c\udf7a' },
  workshop: { color: '#3b82f6', emoji: '\ud83d\udd27' },
  dealership: { color: '#06b6d4', emoji: '\ud83c\udfcd\ufe0f' },
  emergency: { color: '#ef4444', emoji: '\u2695\ufe0f' },
  rest_stop: { color: '#94a3b8', emoji: '\ud83c\udd7f\ufe0f' },
  scenic: { color: '#10b981', emoji: '\ud83c\udfd6\ufe0f' },
  accommodation: { color: '#8b5cf6', emoji: '\ud83d\udecf\ufe0f' },
  atm: { color: '#facc15', emoji: '\ud83d\udcb3' },
  event: { color: '#FF6F00', emoji: '\ud83c\udfc1' },
  distress: { color: '#ef4444', emoji: '\ud83c\udd98' },
};

function PoiVisual({ category }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.rest_stop;
  return (
    <div style={{ width: 36, height: 36, background: config.color, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', border: '2px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ transform: 'rotate(45deg)', fontSize: 16 }}>{config.emoji}</span>
    </div>
  );
}

function LongPressHandler({ onLongPress, disabled }) {
  const map = useMapInstance();
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const onLongPressRef = useRef(onLongPress);
  useEffect(() => { onLongPressRef.current = onLongPress; }, [onLongPress]);

  useEffect(() => {
    if (!map || disabled || !onLongPress) return;
    const container = map.getContainer();
    const clear = () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      startRef.current = null;
    };
    const start = (clientX, clientY) => {
      clear();
      startRef.current = { clientX, clientY };
      timerRef.current = setTimeout(() => {
        const startPoint = startRef.current;
        if (!startPoint) return;
        const rect = container.getBoundingClientRect();
        const point = map.unproject({ x: startPoint.clientX - rect.left, y: startPoint.clientY - rect.top });
        if (point) onLongPressRef.current?.({ lat: point.lat, lng: point.lng });
        clear();
      }, 650);
    };
    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return clear();
      const t = e.touches[0];
      start(t.clientX, t.clientY);
    };
    const onTouchMove = (e) => {
      const sp = startRef.current;
      if (!sp || !e.touches[0]) return;
      const t = e.touches[0];
      if (Math.hypot(t.clientX - sp.clientX, t.clientY - sp.clientY) > 12) clear();
    };
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', clear, { passive: true });
    container.addEventListener('touchcancel', clear, { passive: true });
    return () => {
      clear();
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', clear);
      container.removeEventListener('touchcancel', clear);
    };
  }, [map, disabled]);

  return null;
}

function ZoomTracker({ onZoom }) {
  const map = useMapInstance();
  useEffect(() => {
    if (!map) return;
    const emit = () => onZoom(map.getZoom());
    emit();
    map.on('zoom', emit);
    return () => map.off('zoom', emit);
  }, [map, onZoom]);
  return null;
}

function LocationLock({ center, locked, zoom }) {
  const map = useMapInstance();
  const previousCenterRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    if (locked) {
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.doubleClickZoom.disable();
      map.dragRotate.disable();
      map.touchZoomRotate.disable();
    } else {
      map.dragPan.enable();
      map.scrollZoom.enable();
      map.doubleClickZoom.enable();
      map.dragRotate.enable();
      map.touchZoomRotate.enable();
    }
  }, [map, locked]);

  useEffect(() => {
    if (!map || !locked || !center) return;
    const pos = [Number(center[1]), Number(center[0])];
    const previous = previousCenterRef.current;
    const changed = !previous || previous[0] !== pos[0] || previous[1] !== pos[1];
    if (changed) {
      map.panTo(pos);
      if (zoom != null && !previous) map.setZoom(zoom);
    }
    previousCenterRef.current = pos;
  }, [map, locked, center?.[0], center?.[1], zoom]);

  return null;
}

function CompassReset({ signal }) {
  const map = useMapInstance();
  useEffect(() => {
    if (!map || signal <= 0) return;
    map.setBearing(0);
    map.setPitch(0);
  }, [map, signal]);
  return null;
}

function Recenter({ center, zoom, signal }) {
  const map = useMapInstance();
  const firstRef = useRef(true);
  useEffect(() => {
    if (!map || !center) return;
    const pos = [Number(center[1]), Number(center[0])];
    if (firstRef.current) {
      map.setCenter(pos);
      if (zoom != null) map.setZoom(zoom);
      firstRef.current = false;
    } else if (signal > 0) {
      map.panTo(pos);
    }
  }, [center?.[0], center?.[1], signal, map, zoom]);
  return null;
}

function FitRoute({ route, signal }) {
  const map = useMapInstance();
  useEffect(() => {
    if (!map || signal <= 0 || !route || route.length < 2) return;
    const bounds = new maplibregl.LngLatBounds();
    route.forEach(([lat, lng]) => bounds.extend([Number(lng), Number(lat)]));
    map.fitBounds(bounds, { padding: 60 });
  }, [signal, map, route]);
  return null;
}

function NavCamera({ userPos, heading, speed, nextManeuverDistance, recenterToken, headingUp, onFollowingChange }) {
  useMapLibreCamera({ userPos, heading, headingUp, speed, nextManeuverDistance, recenterToken, onFollowingChange });
  return null;
}

const isValid = (lat, lng) =>
  lat != null && lng != null && !isNaN(lat) && !isNaN(lng) &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

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
  compassResetSignal = 0,
  fitRouteSignal = 0,
  locationLocked = false,
  layer = 'dark',
  onMarkerClick,
  onSavePin,
  onNavigatePin,
  services = [],
  showServices = false,
  onServiceClick,
  fuelStations = [],
  friends = [],
  onFriendClick,
  onLongPress,
  savedPlaces = [],
  groupSavedPlaces = [],
  showSavedPlaces = true,
  onSavedPlaceClick,
  onGroupPlaceClick,
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
  onFollowingChange,
}) {
  const [popupItem, setPopupItem] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(zoom);
  const bgColor = getLayerBackground(layer);
  const SERVICE_MIN_ZOOM = 13;

  const coarseUserPos = useMemo(() => {
    if (!userPos) return null;
    return [Math.round(userPos[0] * 100) / 100, Math.round(userPos[1] * 100) / 100];
  }, [userPos?.[0], userPos?.[1]]);

  const poiMarkers = null;
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
        <div style={{ width: 38, height: 38, background: '#f59e0b', borderRadius: '50%', border: '3px solid white', boxShadow: '0 3px 12px rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{'\u26a0\ufe0f'}</div>
      </CustomMapMarker>
    )),
    [routeWarnings]
  );
  const poiMarkersVisible = navActive || zoomLevel > 12;
  const servicesVisible = showServices && poiMarkersVisible;
  const serviceMarkers = useMemo(
    () => servicesVisible ? (
      <ServiceMarkers services={services} userPos={coarseUserPos} onMarkerClick={onServiceClick || setPopupItem} />
    ) : null,
    [servicesVisible, services, coarseUserPos, onServiceClick]
  );

  return (
    <MapLibreContainer
      center={center}
      zoom={zoom}
      layer={layer}
      className={className}
      onContextMenu={onLongPress && !navActive ? onLongPress : undefined}
    >
      <ZoomTracker onZoom={setZoomLevel} />
      <LongPressHandler onLongPress={onLongPress} disabled={navActive} />
      <CompassReset signal={compassResetSignal} />

      {navActive ? (
        <NavCamera
          userPos={userPos || center}
          heading={heading}
          speed={speed}
          nextManeuverDistance={nextManeuverDistance}
          recenterToken={recenterSignal}
          headingUp={headingUp}
          onFollowingChange={onFollowingChange}
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
          <MapLibreLine id="completed-casing" coordinates={completedRoute} color="#ffffff" width={11} opacity={0.9} />
          <MapLibreLine id="completed" coordinates={completedRoute} color="#9aa0a6" width={7} opacity={0.7} />
        </>
      )}
      {navActive && remainingRoute && remainingRoute.length > 1 && (
        <>
          <MapLibreLine id="remaining-casing" coordinates={remainingRoute} color="#ffffff" width={11} opacity={1} />
          <MapLibreLine id="remaining" coordinates={remainingRoute} color="#2D7FF9" width={7} opacity={1} />
        </>
      )}
      {!navActive && route && route.length > 1 && (
        <MapLibreLine id="route" coordinates={route} color="#FF6F00" width={5} opacity={0.85} />
      )}

      {showSavedPlaces && savedPlaces.map((place) => isValid(place.lat, place.lng) && (
        <MapLibreCircle
          key={`saved-place-${place.id}`}
          id={`saved-place-${place.id}`}
          center={[Number(place.lat), Number(place.lng)]}
          radius={Number(place.radius_m || 50)}
          strokeColor="#3B82F6"
          strokeOpacity={0.85}
          strokeWeight={2}
          fillColor="#3B82F6"
          fillOpacity={0.10}
        />
      ))}
      {showSavedPlaces && groupSavedPlaces.map((place) => isValid(place.lat, place.lng) && (
        <MapLibreCircle
          key={`group-saved-place-${place.id}`}
          id={`group-saved-place-${place.id}`}
          center={[Number(place.lat), Number(place.lng)]}
          radius={Number(place.radius_m || 50)}
          strokeColor="#3B82F6"
          strokeOpacity={0.4}
          strokeWeight={1}
          fillColor="#3B82F6"
          fillOpacity={0.05}
        />
      ))}

      {destination && (
        <CustomMapMarker position={[destination.lat, destination.lng]} anchor="bottom">
          <div style={{ width: 28, height: 28, background: '#4285F4', borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }} />
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
      <FuelStationMarkers stations={fuelStations} onMarkerClick={(station) => setPopupItem({ ...station, category: 'fuel' })} />

      <LiveMarkers
        rider={riders[0] || null}
        friends={friends}
        groupRiders={groupRiders}
        onFriendClick={onFriendClick}
        headingUp={navActive && headingUp}
      />

      {popupItem && (
        <MapLibrePopup
          position={{ lat: popupItem.lat, lng: popupItem.lng }}
          onClose={() => setPopupItem(null)}
        >
          <MapPopupContent
            item={popupItem}
            onMoreInfo={() => { onMarkerClick?.(popupItem); setPopupItem(null); }}
            onSave={() => { onSavePin?.(popupItem); setPopupItem(null); }}
            onNavigate={() => { onNavigatePin?.(popupItem); setPopupItem(null); }}
          />
        </MapLibrePopup>
      )}
    </MapLibreContainer>
  );
}