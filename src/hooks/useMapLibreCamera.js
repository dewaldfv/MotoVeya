import { useEffect, useRef } from 'react';
import { useMapInstance } from '@/lib/maplibreContext';

/**
 * useMapLibreCamera — smoothly drives the MapLibre camera during active
 * navigation. This is the MapLibre equivalent of the Google Maps useMapCamera
 * hook, adapted for MapLibre's setBearing/setPitch/jumpTo API.
 *
 * Key advantage: MapLibre supports 60-degree pitch natively via setPitch() —
 * no vector Map ID is required (unlike Google Maps).
 *
 * Ride Mode follows the rider, but manual pan/zoom/rotation temporarily
 * disengages camera following for 5 seconds. The recenter button restores
 * rider-follow mode immediately. GPS tracking continues uninterrupted.
 *
 * Heading-up is handled by the MapLibre camera bearing. The map DOM is never
 * CSS-rotated.
 */
export function useMapLibreCamera({ userPos, heading, speed, nextManeuverDistance, recenterToken, headingUp = true, onFollowingChange }) {
  const map = useMapInstance();
  const rafRef = useRef(null);
  const currentCenterRef = useRef(null);
  const currentZoomRef = useRef(null);
  const currentBearingRef = useRef(null);
  const currentPitchRef = useRef(null);
  const targetRef = useRef(null);
  const followingRef = useRef(true);
  const programmaticZoomRef = useRef(null);
  const programmaticBearingRef = useRef(null);
  const manualOverrideTimerRef = useRef(null);
  const filteredSpeedRef = useRef(0);
  const filteredHeadingRef = useRef(null);

  const setFollowing = (value) => {
    if (followingRef.current === value) return;
    followingRef.current = value;
    onFollowingChange?.(value);
  };

  // Manual override detection — listen for user gestures
  useEffect(() => {
    if (!map) return;
    const MANUAL_OVERRIDE_MS = 5000;

    const restartManualOverride = () => {
      setFollowing(false);
      if (manualOverrideTimerRef.current) clearTimeout(manualOverrideTimerRef.current);
      manualOverrideTimerRef.current = setTimeout(() => {
        manualOverrideTimerRef.current = null;
        if (targetRef.current) setFollowing(true);
      }, MANUAL_OVERRIDE_MS);
    };

    const onDragStart = () => restartManualOverride();
    const onZoom = () => {
      const actualZoom = map.getZoom();
      if (actualZoom == null) return;
      if (programmaticZoomRef.current != null && Math.abs(actualZoom - programmaticZoomRef.current) < 0.3) {
        programmaticZoomRef.current = null;
        return;
      }
      currentZoomRef.current = actualZoom;
      restartManualOverride();
    };
    const onRotate = () => {
      const actual = Number(map.getBearing?.() ?? 0);
      if (programmaticBearingRef.current != null && Math.abs(shortestAngleDelta(actual, programmaticBearingRef.current)) < 8) {
        programmaticBearingRef.current = null;
        return;
      }
      restartManualOverride();
    };

    map.on('dragstart', onDragStart);
    map.on('zoom', onZoom);
    map.on('rotate', onRotate);

    return () => {
      map.off('dragstart', onDragStart);
      map.off('zoom', onZoom);
      map.off('rotate', onRotate);
      if (manualOverrideTimerRef.current) clearTimeout(manualOverrideTimerRef.current);
      manualOverrideTimerRef.current = null;
    };
  }, [map]);

  // Update the tracking target whenever the rider's GPS inputs change
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
    const pitch = headingUp ? 60 : 0;
    const target = { ...targetCenter, zoom, bearing, pitch };
    targetRef.current = target;

    // First frame — snap to the rider with no animation
    if (!currentCenterRef.current) {
      currentCenterRef.current = { lat: target.lat, lng: target.lng };
      currentZoomRef.current = target.zoom;
      currentBearingRef.current = target.bearing;
      currentPitchRef.current = target.pitch;
      programmaticZoomRef.current = currentZoomRef.current;
      programmaticBearingRef.current = currentBearingRef.current;
      map.jumpTo({
        center: [target.lng, target.lat],
        zoom: currentZoomRef.current,
        bearing: currentBearingRef.current,
        pitch: currentPitchRef.current,
      });
    }
  }, [userPos?.[0], userPos?.[1], heading, headingUp, speed, nextManeuverDistance, map]);

  // Manual recenter token (the "My Location" button) — snap immediately
  useEffect(() => {
    if (!map || !recenterToken || !targetRef.current) return;
    if (manualOverrideTimerRef.current) clearTimeout(manualOverrideTimerRef.current);
    manualOverrideTimerRef.current = null;
    setFollowing(true);
    currentCenterRef.current = { lat: targetRef.current.lat, lng: targetRef.current.lng };
    currentZoomRef.current = targetRef.current.zoom;
    currentBearingRef.current = targetRef.current.bearing ?? 0;
    currentPitchRef.current = targetRef.current.pitch ?? (headingUp ? 60 : 0);
    programmaticBearingRef.current = currentBearingRef.current;
    programmaticZoomRef.current = currentZoomRef.current;
    map.jumpTo({
      center: [currentCenterRef.current.lng, currentCenterRef.current.lat],
      zoom: currentZoomRef.current,
      bearing: currentBearingRef.current,
      pitch: currentPitchRef.current,
    });
  }, [recenterToken, map]);

  // Continuous catch-up loop — eases toward the target every frame
  useEffect(() => {
    if (!map) return;
    const SMOOTH = 0.18;
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
        currentPitchRef.current = lerp(currentPitchRef.current ?? target.pitch, target.pitch, 0.12);

        programmaticBearingRef.current = currentBearingRef.current;
        programmaticZoomRef.current = currentZoomRef.current;
        map.jumpTo({
          center: [cur.lng, cur.lat],
          zoom: currentZoomRef.current,
          bearing: currentBearingRef.current,
          pitch: currentPitchRef.current ?? target.pitch ?? 60,
        });
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
  if (!headingUp || heading == null || !map?.getContainer) return { lat, lng };

  // Keep the motorcycle in the lower third of the display by putting the
  // camera substantially ahead in the direction of travel.
  const height = Math.max(320, Number(map.getContainer()?.clientHeight || 640));
  const metersPerPixel = 156543.03392 * Math.cos((lat * Math.PI) / 180) / Math.pow(2, Number(zoom) || 16);
  const forwardMeters = Math.min(Math.max(height * metersPerPixel * 0.24, 55), 650);
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