/* global google */
import { useEffect, useState, useRef, useMemo } from 'react';
import { GoogleMap, Polyline, InfoWindow, useGoogleMap } from '@react-google-maps/api';
import { useGoogleMapsLoaded } from '@/lib/googleMapsLoader';
import { MAP_LAYERS, getLayerStyles, getLayerBackground, getMapOptions } from '@/lib/mapLayers';
import { getEventMarkerUrl } from '@/lib/eventMarkers';
import CustomMapMarker from './CustomMapMarker';
import RiderMarker from './RiderMarker';
import ServiceMarkers from './ServiceMarkers';
import FriendMarkers from './FriendMarkers';
import GroupRiderMarkers from './GroupRiderMarkers';
import MapPopupContent from './MapPopupContent';

const SA_CENTER = [-26.2041, 28.0473];

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

function PoiVisual({ category }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.rest_stop;
  return (
    <div style={{ width: 36, height: 36, background: config.color, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', border: '2px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ transform: 'rotate(45deg)', fontSize: 16 }}>{config.emoji}</span>
    </div>
  );
}

function EventVisual({ iconUrl }) {
  return (
    <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: '3px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
      <img src={iconUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
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
  const failCountRef = useRef(0);
  const targetZoom = useMemo(() => {
    if (nextManeuverDistance != null && nextManeuverDistance < 200) return 17;
    if (speed > 80) return 14;
    if (speed > 40) return 16;
    return 16;
  }, [speed, nextManeuverDistance]);

  useEffect(() => {
    if (!map) return;
    map.setOptions({ draggable: false, scrollwheel: false, disableDoubleClickZoom: true, gestureHandling: 'none' });
    return () => {
      map.setOptions({ draggable: true, scrollwheel: true, disableDoubleClickZoom: false, gestureHandling: 'auto' });
    };
  }, [map]);

  useEffect(() => {
    if (!map || !userPos) return;
    try {
      if (headingUp && heading != null && !isNaN(heading)) {
        const projection = map.getProjection();
        if (!projection) throw new Error('No projection');
        const headingRad = (heading * Math.PI) / 180;
        const containerEl = map.getDiv();
        const offsetPx = (containerEl.offsetHeight || 600) * 0.30;
        const scale = Math.pow(2, map.getZoom());
        const riderPoint = projection.fromLatLngToPoint(new google.maps.LatLng(userPos[0], userPos[1]));
        const offsetX = (offsetPx * Math.sin(headingRad)) / scale;
        const offsetY = (-offsetPx * Math.cos(headingRad)) / scale;
        const centerPoint = new google.maps.Point(riderPoint.x + offsetX, riderPoint.y + offsetY);
        const centerLatLng = projection.fromPointToLatLng(centerPoint);
        map.setCenter(centerLatLng);
        map.setZoom(targetZoom);
      } else {
        map.setCenter({ lat: userPos[0], lng: userPos[1] });
        map.setZoom(targetZoom);
      }
      failCountRef.current = 0;
    } catch (e) {
      failCountRef.current++;
      if (failCountRef.current >= 2) {
        map.setCenter({ lat: userPos[0], lng: userPos[1] });
        map.setZoom(targetZoom);
        failCountRef.current = 0;
      }
    }
  }, [userPos?.[0], userPos?.[1], heading, targetZoom, map, recenterToken, headingUp]);

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
  route = null,
  recenterSignal = 0,
  fitRouteSignal = 0,
  layer = 'dark',
  onMarkerClick,
  onSavePin,
  onNavigatePin,
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
  const isLoaded = useGoogleMapsLoaded();
  const [popupItem, setPopupItem] = useState(null);
  const bgColor = getLayerBackground(layer);
  const rotating = navActive && heading != null && !isNaN(heading) && headingUp;
  const navRot = rotating ? `${-heading}deg` : '0deg';
  const initialCenterRef = useRef(null);
  if (!initialCenterRef.current) {
    initialCenterRef.current = { lat: center[0], lng: center[1] };
  }

  const validPois = pois.filter((p) => isValid(p.lat, p.lng));
  const validEvents = events.filter((e) => isValid(e.lat, e.lng));
  const validDistress = distressAlerts.filter((d) => isValid(d.lat, d.lng));
  const validRiders = riders.filter((r) => isValid(r.lat, r.lng));

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

        {validPois.map((poi) => (
          <CustomMapMarker key={`poi-${poi.id}`} position={[poi.lat, poi.lng]} onClick={() => setPopupItem(poi)}>
            <PoiVisual category={poi.category} />
          </CustomMapMarker>
        ))}

        {validEvents.map((ev) => (
          <CustomMapMarker key={`event-${ev.id}`} position={[ev.lat, ev.lng]} onClick={() => setPopupItem(ev)}>
            <EventVisual iconUrl={ev.markerIcon || getEventMarkerUrl(ev.category)} />
          </CustomMapMarker>
        ))}

        {validDistress.map((d) => (
          <CustomMapMarker key={`distress-${d.id}`} position={[d.lat, d.lng]} onClick={() => setPopupItem(d)}>
            <PoiVisual category="distress" />
          </CustomMapMarker>
        ))}

        {validRiders.map((r) => (
          <RiderMarker key={`rider-${r.id}`} position={[r.lat, r.lng]} heading={r.heading} accuracy={r.accuracy} zIndex={1200} />
        ))}

        {showServices && <ServiceMarkers services={services} userPos={userPos} onMarkerClick={onServiceClick} />}

        {showFriends && <FriendMarkers friends={friends} onSelect={onFriendClick} />}

        {groupRiders.length > 0 && <GroupRiderMarkers participants={groupRiders} />}

        {popupItem && (
          <InfoWindow position={{ lat: popupItem.lat, lng: popupItem.lng }} onCloseClick={() => setPopupItem(null)}>
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