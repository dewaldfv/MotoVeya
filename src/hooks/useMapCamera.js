/* global google */
import { useEffect, useRef } from 'react';

/**
 * useMapCamera — smoothly drives the Google Map camera during active navigation.
 *
 * Ride Mode starts by following the rider, but manual map interaction takes
 * control of the camera. Once the rider pans or zooms, GPS updates continue in
 * the background without moving the camera. The "My Location" / recenter button
 * explicitly restores rider-follow mode.
 *
 * Bottom-third placement and heading rotation are handled by CSS on the
 * rotating container (see .nav-map-heading-up in index.css), so the camera
 * center here simply tracks the rider's raw GPS position.
 */
export function useMapCamera({ map, userPos, speed, nextManeuverDistance, recenterToken }) {
  const rafRef = useRef(null);
  const currentCenterRef = useRef(null);
  const currentZoomRef = useRef(null);
  const targetRef = useRef(null);
  const followingRef = useRef(true);
  const suppressCameraEventsRef = useRef(false);

  // Ride Mode remains fully interactive. Manual pan/zoom disengages camera
  // following; GPS tracking itself continues uninterrupted.
  useEffect(() => {
    if (!map) return;
    map.setOptions({ draggable: true, scrollwheel: true, disableDoubleClickZoom: false, gestureHandling: 'greedy' });
    const onManualInteraction = () => {
      if (suppressCameraEventsRef.current) return;
      followingRef.current = false;
    };
    const dragStart = map.addListener('dragstart', onManualInteraction);
    const zoomChanged = map.addListener('zoom_changed', onManualInteraction);
    return () => {
      dragStart?.remove?.();
      zoomChanged?.remove?.();
    };
  }, [map]);

  // Update the tracking target whenever the rider's position or zoom inputs change.
  useEffect(() => {
    if (!map || !userPos) return;
    const target = {
      lat: userPos[0],
      lng: userPos[1],
      zoom: resolveTargetZoom(speed, nextManeuverDistance)
    };
    targetRef.current = target;
    // First frame — snap to the rider with no animation.
    if (!currentCenterRef.current) {
      currentCenterRef.current = { lat: target.lat, lng: target.lng };
      currentZoomRef.current = target.zoom;
      suppressCameraEventsRef.current = true;
      map.setCenter(currentCenterRef.current);
      map.setZoom(currentZoomRef.current);
      queueMicrotask(() => { suppressCameraEventsRef.current = false; });
    }
  }, [userPos?.[0], userPos?.[1], speed, nextManeuverDistance, map]);

  // Manual recenter token (the "My Location" button) — snap immediately.
  useEffect(() => {
    if (!map || !recenterToken || !targetRef.current) return;
    followingRef.current = true;
    currentCenterRef.current = { lat: targetRef.current.lat, lng: targetRef.current.lng };
    currentZoomRef.current = targetRef.current.zoom;
    suppressCameraEventsRef.current = true;
    map.setCenter(currentCenterRef.current);
    map.setZoom(currentZoomRef.current);
    queueMicrotask(() => { suppressCameraEventsRef.current = false; });
  }, [recenterToken, map]);

  // Continuous catch-up loop — eases toward the target every frame.
  // Robust to frequent GPS updates: the loop never restarts, the target just
  // shifts, so motion stays fluid instead of stuttering on each new fix.
  useEffect(() => {
    if (!map) return;
    const SMOOTH = 0.18; // fraction of the remaining gap closed per frame (~60fps)
    const tick = () => {
      const target = targetRef.current;
      const cur = currentCenterRef.current;
      if (target && cur && followingRef.current) {
        const dLat = target.lat - cur.lat;
        const dLng = target.lng - cur.lng;
        const dZoom = target.zoom - (currentZoomRef.current ?? target.zoom);
        // Only repaint when the change is meaningful — avoids sub-pixel jitter at rest.
        if (Math.abs(dLat) > 1e-6 || Math.abs(dLng) > 1e-6 || Math.abs(dZoom) > 0.01) {
          cur.lat += dLat * SMOOTH;
          cur.lng += dLng * SMOOTH;
          currentZoomRef.current += dZoom * SMOOTH;
          suppressCameraEventsRef.current = true;
          map.setCenter({ lat: cur.lat, lng: cur.lng });
          map.setZoom(currentZoomRef.current);
          queueMicrotask(() => { suppressCameraEventsRef.current = false; });
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [map]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);
}

function resolveTargetZoom(speed, nextManeuverDistance) {
  if (nextManeuverDistance != null && nextManeuverDistance < 200) return 17;
  if (speed > 80) return 14;
  if (speed > 40) return 16;
  return 16;
}