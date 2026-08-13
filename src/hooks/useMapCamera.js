/* global google */
import { useEffect, useRef, useState } from 'react';

const lerp = (a, b, t) => a + (b - a) * t;
const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * useMapCamera — smoothly drives the Google Map camera during active navigation.
 *
 * The map stays pannable so the rider can look around; while they pan, auto-
 * centering pauses. After 5 seconds of inactivity the camera snaps back to the
 * rider. The bottom-third placement of the rider is handled by a CSS transform
 * on the rotating container (see .nav-map-heading-up in index.css), so here the
 * map center simply tracks the rider's raw GPS position.
 */
export function useMapCamera({ map, userPos, heading, headingUp, speed, nextManeuverDistance, recenterToken }) {
  const animRef = useRef(null);
  const currentCenterRef = useRef(null);
  const currentZoomRef = useRef(null);
  const userPannedRef = useRef(false);
  const recenterTimerRef = useRef(null);
  const [recenterTick, setRecenterTick] = useState(0);

  // Keep the map pannable during navigation; zoom stays controlled.
  useEffect(() => {
    if (!map) return;
    map.setOptions({ draggable: true, scrollwheel: false, disableDoubleClickZoom: true, gestureHandling: 'greedy' });
    return () => {
      map.setOptions({ draggable: true, scrollwheel: true, disableDoubleClickZoom: false, gestureHandling: 'auto' });
    };
  }, [map]);

  // Pause auto-center while the rider pans; recenter after 5s of inactivity.
  useEffect(() => {
    if (!map) return;
    const onDragStart = () => {
      userPannedRef.current = true;
      if (recenterTimerRef.current) { clearTimeout(recenterTimerRef.current); recenterTimerRef.current = null; }
    };
    const onDragEnd = () => {
      if (recenterTimerRef.current) clearTimeout(recenterTimerRef.current);
      recenterTimerRef.current = setTimeout(() => {
        userPannedRef.current = false;
        currentCenterRef.current = null; // snap (not ease) on recenter
        setRecenterTick((t) => t + 1);
      }, 5000);
    };
    map.addListener('dragstart', onDragStart);
    map.addListener('dragend', onDragEnd);
    return () => {
      google.maps.event.clearListeners(map, 'dragstart');
      google.maps.event.clearListeners(map, 'dragend');
      if (recenterTimerRef.current) clearTimeout(recenterTimerRef.current);
    };
  }, [map]);

  // Manual recenter token (e.g. the "My Location" button) — snap back immediately.
  useEffect(() => {
    if (!map || !recenterToken) return;
    userPannedRef.current = false;
    currentCenterRef.current = null;
    if (recenterTimerRef.current) { clearTimeout(recenterTimerRef.current); recenterTimerRef.current = null; }
  }, [recenterToken, map]);

  // Drive the camera on every position / heading / speed update.
  useEffect(() => {
    if (!map || !userPos) return;
    if (userPannedRef.current) return; // rider is panning — don't fight them
    const targetCenter = new google.maps.LatLng(userPos[0], userPos[1]);
    const targetZoom = resolveTargetZoom(speed, nextManeuverDistance);

    // First frame (or after a recenter snap) — initialize without animation.
    if (!currentCenterRef.current) {
      currentCenterRef.current = targetCenter;
      currentZoomRef.current = targetZoom;
      map.setCenter(targetCenter);
      map.setZoom(targetZoom);
      return;
    }

    if (animRef.current) cancelAnimationFrame(animRef.current);
    const start = performance.now();
    const duration = 700;
    const startCenter = { ...currentCenterRef.current };
    const startZoom = currentZoomRef.current ?? targetZoom;

    const animate = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeInOutQuad(t);
      currentCenterRef.current = {
        lat: lerp(startCenter.lat, targetCenter.lat, eased),
        lng: lerp(startCenter.lng, targetCenter.lng, eased),
      };
      currentZoomRef.current = lerp(startZoom, targetZoom, eased);
      map.setCenter(currentCenterRef.current);
      map.setZoom(currentZoomRef.current);
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        animRef.current = null;
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [userPos?.[0], userPos?.[1], heading, headingUp, speed, nextManeuverDistance, map, recenterToken, recenterTick]);

  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }, []);
}

function resolveTargetZoom(speed, nextManeuverDistance) {
  if (nextManeuverDistance != null && nextManeuverDistance < 200) return 17;
  if (speed > 80) return 14;
  if (speed > 40) return 16;
  return 16;
}