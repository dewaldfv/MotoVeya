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
 * Heading-up is handled by the Google Maps camera bearing. The map DOM is
 * never CSS-rotated, which keeps map tiles, controls, markers and overlays in
 * the same geographic coordinate system.
 */
export function useMapCamera({ map, userPos, heading, speed, nextManeuverDistance, recenterToken, headingUp = true }) {
  const rafRef = useRef(null);
  const currentCenterRef = useRef(null);
  const currentZoomRef = useRef(null);
  const targetRef = useRef(null);
  const followingRef = useRef(true);
  const suppressCameraEventsRef = useRef(false);
  const programmaticZoomRef = useRef(null);

  // Ride Mode remains fully interactive. Manual pan/zoom disengages camera
  // following; GPS tracking itself continues uninterrupted.
  useEffect(() => {
    if (!map) return;
    map.setOptions({ draggable: true, scrollwheel: true, disableDoubleClickZoom: false, gestureHandling: 'greedy' });
    const onManualInteraction = () => {
      if (suppressCameraEventsRef.current) return;
      followingRef.current = false;
    };
    const onZoomChanged = () => {
      // Keep the actual user-selected zoom in sync. A manual pinch/scroll must
      // take control of the camera and must not be overwritten by the next GPS
      // speed/navigation update.
      const actualZoom = map.getZoom();
      if (actualZoom == null) return;
      currentZoomRef.current = actualZoom;
      if (programmaticZoomRef.current != null && actualZoom === programmaticZoomRef.current) {
        programmaticZoomRef.current = null;
        return;
      }
      followingRef.current = false;
    };
    const dragStart = map.addListener('dragstart', onManualInteraction);
    const zoomChanged = map.addListener('zoom_changed', onZoomChanged);
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
    // Google Maps bearing is the correct way to implement heading-up mode.
    // Do not rotate the DOM/container: that rotates the entire rendered map layer.
    if (headingUp && heading != null && Number.isFinite(Number(heading))) {
      const bearing = ((Number(heading) % 360) + 360) % 360;
      map.setHeading?.(bearing);
    } else if (!headingUp) {
      map.setHeading?.(0);
    }
    targetRef.current = target;
    // First frame — snap to the rider with no animation.
    if (!currentCenterRef.current) {
      currentCenterRef.current = { lat: target.lat, lng: target.lng };
      currentZoomRef.current = target.zoom;
      suppressCameraEventsRef.current = true;
      map.setCenter(currentCenterRef.current);
      programmaticZoomRef.current = Math.round(currentZoomRef.current);
      map.setZoom(Math.round(currentZoomRef.current));
      queueMicrotask(() => { suppressCameraEventsRef.current = false; });
    }
  }, [userPos?.[0], userPos?.[1], heading, headingUp, speed, nextManeuverDistance, map]);

  // Manual recenter token (the "My Location" button) — snap immediately.
  useEffect(() => {
    if (!map || !recenterToken || !targetRef.current) return;
    followingRef.current = true;
    currentCenterRef.current = { lat: targetRef.current.lat, lng: targetRef.current.lng };
    currentZoomRef.current = targetRef.current.zoom;
    suppressCameraEventsRef.current = true;
    map.setCenter(currentCenterRef.current);
    programmaticZoomRef.current = Math.round(currentZoomRef.current);
    map.setZoom(Math.round(currentZoomRef.current));
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
        // Keep zoom changes discrete. Animating zoom on every frame causes
        // Google Maps to emit zoom_changed repeatedly and can fight the follow camera.
        if (Math.abs(dLat) > 1e-7 || Math.abs(dLng) > 1e-7) {
          cur.lat += dLat * SMOOTH;
          cur.lng += dLng * SMOOTH;
          suppressCameraEventsRef.current = true;
          map.setCenter({ lat: cur.lat, lng: cur.lng });
          queueMicrotask(() => { suppressCameraEventsRef.current = false; });
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [map]);

  // Automatic navigation zoom is allowed only while the camera is following
  // the rider. Once the rider manually zooms, preserve that zoom until they
  // explicitly recenter. This prevents GPS updates from fighting pinch zoom.
  useEffect(() => {
    if (!map || !targetRef.current || !followingRef.current) return;
    const desired = Math.round(targetRef.current.zoom);
    const actual = map.getZoom();
    if (actual === desired) {
      currentZoomRef.current = desired;
      return;
    }
    currentZoomRef.current = desired;
    programmaticZoomRef.current = desired;
    suppressCameraEventsRef.current = true;
    map.setZoom(desired);
    queueMicrotask(() => { suppressCameraEventsRef.current = false; });
  }, [speed, nextManeuverDistance, map]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);
}

function resolveTargetZoom(speed, nextManeuverDistance) {
  if (nextManeuverDistance != null && nextManeuverDistance < 200) return 17;
  if (speed > 80) return 14;
  if (speed > 40) return 16;
  return 16;
}