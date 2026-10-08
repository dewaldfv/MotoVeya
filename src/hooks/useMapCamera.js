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
export function useMapCamera({ map, userPos, heading, speed, nextManeuverDistance, recenterToken, headingUp = true, onFollowingChange }) {
  const rafRef = useRef(null);
  const currentCenterRef = useRef(null);
  const currentZoomRef = useRef(null);
  const currentBearingRef = useRef(null);
  const targetRef = useRef(null);
  const followingRef = useRef(true);
  const suppressCameraEventsRef = useRef(false);
  const programmaticZoomRef = useRef(null);
  const programmaticHeadingRef = useRef(null);
  const filteredSpeedRef = useRef(0);
  const setFollowing = (value) => {
    if (followingRef.current === value) return;
    followingRef.current = value;
    onFollowingChange?.(value);
  };
  const filteredHeadingRef = useRef(null);

  // Ride Mode remains fully interactive. Manual pan/zoom disengages camera
  // following; GPS tracking itself continues uninterrupted.
  useEffect(() => {
    if (!map) return;
    map.setOptions({ draggable: true, scrollwheel: true, disableDoubleClickZoom: false, gestureHandling: 'greedy' });
    const onManualInteraction = () => {
      if (suppressCameraEventsRef.current) return;
      setFollowing(false);
    };
    const onZoomChanged = () => {
      const actualZoom = map.getZoom();
      if (actualZoom == null) return;
      currentZoomRef.current = actualZoom;
      if (programmaticZoomRef.current != null && Math.abs(actualZoom - programmaticZoomRef.current) < 0.02) {
        programmaticZoomRef.current = null;
        return;
      }
      setFollowing(false);
    };
    const onHeadingChanged = () => {
      const actual = Number(map.getHeading?.() ?? 0);
      if (programmaticHeadingRef.current != null && Math.abs(shortestAngleDelta(actual, programmaticHeadingRef.current)) < 2) {
        programmaticHeadingRef.current = null;
        return;
      }
      setFollowing(false);
    };
    const dragStart = map.addListener('dragstart', onManualInteraction);
    const zoomChanged = map.addListener('zoom_changed', onZoomChanged);
    const headingChanged = map.addListener('heading_changed', onHeadingChanged);
    return () => {
      dragStart?.remove?.();
      zoomChanged?.remove?.();
      headingChanged?.remove?.();
    };
  }, [map]);

  // Update the tracking target whenever the rider's GPS inputs change.
  useEffect(() => {
    if (!map || !userPos) return;

    const rawSpeed = Math.max(0, Number(speed) || 0);
    filteredSpeedRef.current = lerp(filteredSpeedRef.current, rawSpeed, 0.18);

    const rawHeading = Number.isFinite(Number(heading)) ? normalizeAngle(Number(heading)) : null;
    if (rawHeading != null) {
      filteredHeadingRef.current = filteredHeadingRef.current == null
        ? rawHeading
        : moveAngle(filteredHeadingRef.current, rawHeading, 0.16);
    }

    const effectiveHeading = filteredHeadingRef.current;
    const zoom = resolveTargetZoom(filteredSpeedRef.current, nextManeuverDistance);
    const targetCenter = getFollowCenter(map, userPos, effectiveHeading, zoom, headingUp);
    const bearing = headingUp && effectiveHeading != null ? effectiveHeading : 0;
    const target = { ...targetCenter, zoom, bearing };
    targetRef.current = target;
    // First frame — snap to the rider with no animation.
    if (!currentCenterRef.current) {
      currentCenterRef.current = { lat: target.lat, lng: target.lng };
      currentZoomRef.current = target.zoom;
      currentBearingRef.current = target.bearing;
      suppressCameraEventsRef.current = true;
      map.setCenter(currentCenterRef.current);
      programmaticZoomRef.current = currentZoomRef.current;
      programmaticHeadingRef.current = currentBearingRef.current;
      map.setHeading?.(currentBearingRef.current);
      map.setZoom(currentZoomRef.current);
      queueMicrotask(() => { suppressCameraEventsRef.current = false; });
    }
  }, [userPos?.[0], userPos?.[1], heading, headingUp, speed, nextManeuverDistance, map]);

  // Manual recenter token (the "My Location" button) — snap immediately.
  useEffect(() => {
    if (!map || !recenterToken || !targetRef.current) return;
    setFollowing(true);
    currentCenterRef.current = { lat: targetRef.current.lat, lng: targetRef.current.lng };
    currentZoomRef.current = targetRef.current.zoom;
    currentBearingRef.current = targetRef.current.bearing ?? 0;
    suppressCameraEventsRef.current = true;
    map.setCenter(currentCenterRef.current);
    programmaticHeadingRef.current = currentBearingRef.current;
    map.setHeading?.(currentBearingRef.current);
    programmaticZoomRef.current = currentZoomRef.current;
    map.setZoom(currentZoomRef.current);
    queueMicrotask(() => { suppressCameraEventsRef.current = false; });
  }, [recenterToken, map]);

  // Continuous catch-up loop — eases toward the target every frame.
  // Camera position, bearing and zoom are deliberately smoothed independently.
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
        cur.lat += dLat * SMOOTH;
        cur.lng += dLng * SMOOTH;

        currentZoomRef.current = lerp(currentZoomRef.current ?? target.zoom, target.zoom, 0.07);
        currentBearingRef.current = moveAngle(currentBearingRef.current ?? target.bearing, target.bearing, 0.12);

        suppressCameraEventsRef.current = true;
        map.setCenter({ lat: cur.lat, lng: cur.lng });
        if (headingUp) {
          programmaticHeadingRef.current = currentBearingRef.current;
          map.setHeading?.(currentBearingRef.current);
        }
        programmaticZoomRef.current = currentZoomRef.current;
        map.setZoom(currentZoomRef.current);
        queueMicrotask(() => { suppressCameraEventsRef.current = false; });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [map]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);
}

function getFollowCenter(map, userPos, heading, zoom, headingUp) {
  const lat = Number(userPos[0]);
  const lng = Number(userPos[1]);
  if (!headingUp || heading == null || !map?.getDiv) return { lat, lng };

  // Keep the motorcycle in the lower-middle of the display (~40–45% down)
  // by putting the camera slightly ahead in the direction of travel.
  const height = Math.max(320, Number(map.getDiv()?.clientHeight || 640));
  const metersPerPixel = 156543.03392 * Math.cos((lat * Math.PI) / 180) / Math.pow(2, Number(zoom) || 16);
  const forwardMeters = Math.min(Math.max(height * metersPerPixel * 0.15, 35), 450);
  return destinationPoint(lat, lng, heading, forwardMeters);
}

function destinationPoint(lat, lng, bearingDeg, distanceMeters) {
  const R = 6371000;
  const brng = bearingDeg * Math.PI / 180;
  const lat1 = lat * Math.PI / 180;
  const lng1 = lng * Math.PI / 180;
  const delta = distanceMeters / R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(delta) + Math.cos(lat1) * Math.sin(delta) * Math.cos(brng));
  const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(delta) * Math.cos(lat1), Math.cos(delta) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: lat2 * 180 / Math.PI, lng: lng2 * 180 / Math.PI };
}

function lerp(a, b, t) { return a + (b - a) * t; }
function normalizeAngle(deg) { return ((deg % 360) + 360) % 360; }
function shortestAngleDelta(from, to) { return ((to - from + 540) % 360) - 180; }
function moveAngle(from, to, t) { return normalizeAngle(from + shortestAngleDelta(from, to) * t); }

function resolveTargetZoom(speed, nextManeuverDistance) {
  const s = Math.max(0, Number(speed) || 0);
  // Continuous speed-driven zoom: close at low speed, progressively wider at speed.
  const speedZoom = Math.min(17.8, Math.max(14.4, 17.8 - (s * 0.02125)));
  const d = Number(nextManeuverDistance);
  let maneuverBoost = 0;
  if (Number.isFinite(d)) {
    if (d < 120) maneuverBoost = 0.65;
    else if (d < 250) maneuverBoost = 0.35;
    else if (d < 500) maneuverBoost = 0.15;
  }
  return Math.min(18, speedZoom + maneuverBoost);
}