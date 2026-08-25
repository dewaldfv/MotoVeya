/* global google */
import { useEffect, useRef, useMemo, useState } from 'react';
import { GoogleMap, Polyline, useGoogleMap } from '@react-google-maps/api';
import { useGoogleMapsLoaded } from '@/lib/googleMapsLoader';
import { MAP_LAYERS, getLayerStyles, getLayerBackground, getMapOptions } from '@/lib/mapLayers';
import CustomMapMarker from './CustomMapMarker';
import RiderMarker from './RiderMarker';

const SA_CENTER = [-26.2041, 28.0473];

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

function NavCamera({ userPos, heading, active, speed, nextManeuverDistance, route, recenterToken }) {
  const map = useGoogleMap();
  const failCountRef = useRef(0);
  const userPannedRef = useRef(false);
  const userZoomedRef = useRef(false);
  const suppressZoomEventRef = useRef(false);
  const recenterTimerRef = useRef(null);
  const zoomResetTimerRef = useRef(null);
  const zoomListenerRef = useRef(null);
  const [recenterTick, setRecenterTick] = useState(0);
  const targetZoom = useMemo(() => {
    if (!active) return 13;
    if (nextManeuverDistance != null && nextManeuverDistance < 200) return 17;
    if (speed > 80) return 14;
    if (speed > 40) return 16;
    return 16;
  }, [active, speed, nextManeuverDistance]);

  useEffect(() => {
    if (!map) return;
    if (active) {
      // Allow panning during navigation; zoom stays controlled.
      map.setOptions({ draggable: true, scrollwheel: false, disableDoubleClickZoom: true, gestureHandling: 'greedy' });
    } else {
      map.setOptions({ draggable: true, scrollwheel: true, disableDoubleClickZoom: false, gestureHandling: 'auto' });
    }
  }, [active, map]);

  // Allow the rider to pan or pinch-zoom manually during Ride Mode.
  // After 5 seconds without map interaction, restore the normal navigation view.
  useEffect(() => {
    if (!map || !active) return;
    const resetView = () => {
      userPannedRef.current = false;
      userZoomedRef.current = false;
      if (recenterTimerRef.current) { clearTimeout(recenterTimerRef.current); recenterTimerRef.current = null; }
      if (zoomResetTimerRef.current) { clearTimeout(zoomResetTimerRef.current); zoomResetTimerRef.current = null; }
      setRecenterTick((t) => t + 1);
    };
    const scheduleReset = () => {
      if (zoomResetTimerRef.current) clearTimeout(zoomResetTimerRef.current);
      zoomResetTimerRef.current = setTimeout(resetView, 5000);
    };
    const onDragStart = () => {
      userPannedRef.current = true;
      if (recenterTimerRef.current) clearTimeout(recenterTimerRef.current);
      scheduleReset();
    };
    const onDragEnd = () => scheduleReset();
    const onZoomChanged = () => {
      // Google Maps fires zoom_changed for both user gestures and our own setZoom.
      // The ref lets us distinguish our automatic camera changes from a rider pinch/scroll.
      if (suppressZoomEventRef.current) return;
      userZoomedRef.current = true;
      scheduleReset();
    };
    const dragStartListener = map.addListener('dragstart', onDragStart);
    const dragEndListener = map.addListener('dragend', onDragEnd);
    zoomListenerRef.current = map.addListener('zoom_changed', onZoomChanged);
    return () => {
      dragStartListener?.remove?.();
      dragEndListener?.remove?.();
      zoomListenerRef.current?.remove?.();
      zoomListenerRef.current = null;
      if (recenterTimerRef.current) clearTimeout(recenterTimerRef.current);
      if (zoomResetTimerRef.current) clearTimeout(zoomResetTimerRef.current);
    };
  }, [map, active]);

  // Manual recenter token — snap back immediately.
  useEffect(() => {
    if (!map || !recenterToken) return;
    userPannedRef.current = false;
    userZoomedRef.current = false;
    suppressZoomEventRef.current = true;
    if (recenterTimerRef.current) { clearTimeout(recenterTimerRef.current); recenterTimerRef.current = null; }
    if (zoomResetTimerRef.current) { clearTimeout(zoomResetTimerRef.current); zoomResetTimerRef.current = null; }
    queueMicrotask(() => { suppressZoomEventRef.current = false; });
  }, [recenterToken, map]);

  useEffect(() => {
    if (!map || !userPos) return;
    if (userPannedRef.current) return; // rider is panning — don't fight them
    try {
      if (!active && route && route.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        route.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
        map.fitBounds(bounds, 80);
      } else {
        map.setCenter({ lat: userPos[0], lng: userPos[1] });
        if (!userZoomedRef.current) {
          suppressZoomEventRef.current = true;
          map.setZoom(targetZoom);
          queueMicrotask(() => { suppressZoomEventRef.current = false; });
        }
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
  }, [userPos?.[0], userPos?.[1], active, targetZoom, route, map, recenterToken, recenterTick]);

  return null;
}

function toLatLngPath(coords) {
  return (coords || []).map(([lat, lng]) => ({ lat, lng }));
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
  headingUp = true,
  recenterToken = 0,
}) {
  const isLoaded = useGoogleMapsLoaded();
  const bgColor = getLayerBackground(layer);
  const rotating = active && heading != null && !isNaN(heading) && headingUp;
  const navRot = rotating ? `${-heading}deg` : '0deg';
  const initialCenterRef = useRef(null);
  const centerArr = userPos || SA_CENTER;
  if (!initialCenterRef.current) {
    initialCenterRef.current = { lat: centerArr[0], lng: centerArr[1] };
  }

  if (!isLoaded) {
    return <div className="absolute inset-0 z-0" style={{ background: bgColor }} />;
  }

  const options = { ...getMapOptions(layer), gestureHandling: active ? 'greedy' : 'auto', draggable: true, scrollwheel: !active };

  return (
    <div
      className={`absolute inset-0 z-0 ${rotating ? 'nav-map-heading-up' : ''}`}
      style={{ background: bgColor, '--nav-rot': navRot }}
    >
      <GoogleMap
        mapContainerClassName={`absolute inset-0 h-full w-full ${rotating ? 'gm-rotatable' : ''}`}
        center={initialCenterRef.current}
        zoom={14}
        options={options}
      >
        <LayerController layer={layer} />
        <MapResizer />
        <NavCamera
          userPos={userPos}
          heading={heading}
          active={active}
          speed={speed}
          nextManeuverDistance={nextManeuverDistance}
          route={remainingRoute}
          recenterToken={recenterToken}
        />
        {completedRoute && completedRoute.length > 1 && (
          <>
            <Polyline path={toLatLngPath(completedRoute)} options={{ strokeColor: '#ffffff', strokeWeight: 11, strokeOpacity: 0.9 }} />
            <Polyline path={toLatLngPath(completedRoute)} options={{ strokeColor: '#9aa0a6', strokeWeight: 7, strokeOpacity: 0.7 }} />
          </>
        )}
        {remainingRoute && remainingRoute.length > 1 && (
          <>
            <Polyline path={toLatLngPath(remainingRoute)} options={{ strokeColor: '#ffffff', strokeWeight: 11, strokeOpacity: 1 }} />
            <Polyline path={toLatLngPath(remainingRoute)} options={{ strokeColor: '#2D7FF9', strokeWeight: 7, strokeOpacity: 1 }} />
          </>
        )}
        {destination && (
          <CustomMapMarker position={[destination.lat, destination.lng]} anchor="bottom">
            <div style={{ width: 28, height: 28, background: '#4285F4', borderRadius: '50% 50% 50% 0', transform: `rotate(${rotating && heading != null ? -45 + heading : -45}deg)`, border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }} />
          </CustomMapMarker>
        )}
        {userPos && <RiderMarker position={userPos} heading={heading} accuracy={accuracy} />}
      </GoogleMap>
    </div>
  );
}