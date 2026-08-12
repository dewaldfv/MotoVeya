/* global google */
import { useEffect, useRef } from 'react';

const lerp = (a, b, t) => a + (b - a) * t;
const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * useMapCamera — smoothly drives the Google Map camera during active navigation.
 *
 * Instead of hard-snapping map.setCenter() to each raw GPS fix (which produces
 * jittery "jump" pans), this hook interpolates the camera center + zoom from
 * their current values toward the new target over a short easing window using
 * requestAnimationFrame. When headingUp is enabled, the target center is offset
 * ahead of the rider so the rider sits in the lower third of the viewport and
 * the direction of travel faces up.
 */
export function useMapCamera({ map, userPos, heading, headingUp, speed, nextManeuverDistance, recenterToken }) {
  const animRef = useRef(null);
  const currentCenterRef = useRef(null);
  const currentZoomRef = useRef(null);

  // Lock map gestures during navigation; restore on cleanup.
  useEffect(() => {
    if (!map) return;
    map.setOptions({ draggable: false, scrollwheel: false, disableDoubleClickZoom: true, gestureHandling: 'none' });
    return () => {
      map.setOptions({ draggable: true, scrollwheel: true, disableDoubleClickZoom: false, gestureHandling: 'auto' });
    };
  }, [map]);

  // Recenter token — cancel any in-flight easing and snap to the rider.
  useEffect(() => {
    if (!map || !recenterToken || !currentCenterRef.current) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const zoom = resolveTargetZoom(speed, nextManeuverDistance);
    currentZoomRef.current = zoom;
    map.setZoom(zoom);
    // Re-project the offset so the snap still respects heading-up.
    const center = computeTargetCenter(map, userPos, heading, headingUp);
    if (center) {
      currentCenterRef.current = center;
      map.setCenter(center);
    }
  }, [recenterToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drive the camera on every position / heading / speed update.
  useEffect(() => {
    if (!map || !userPos) return;
    const targetCenter = computeTargetCenter(map, userPos, heading, headingUp);
    const targetZoom = resolveTargetZoom(speed, nextManeuverDistance);
    if (!targetCenter) return;

    // First frame — initialize without animation.
    if (!currentCenterRef.current) {
      currentCenterRef.current = targetCenter;
      currentZoomRef.current = targetZoom;
      map.setCenter(targetCenter);
      map.setZoom(targetZoom);
      return;
    }

    // Cancel any running easing and start a fresh interpolation.
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
  }, [userPos?.[0], userPos?.[1], heading, headingUp, speed, nextManeuverDistance, map]);

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

// Compute the map center that places the rider in the lower third when
// heading-up is active, otherwise returns the raw rider position.
function computeTargetCenter(map, userPos, heading, headingUp) {
  if (!userPos) return null;
  if (!headingUp || heading == null || isNaN(heading)) {
    return new google.maps.LatLng(userPos[0], userPos[1]);
  }
  try {
    const projection = map.getProjection();
    if (!projection) return new google.maps.LatLng(userPos[0], userPos[1]);
    const headingRad = (heading * Math.PI) / 180;
    const containerEl = map.getDiv();
    const offsetPx = (containerEl.offsetHeight || 600) * 0.30;
    const scale = Math.pow(2, map.getZoom());
    const riderPoint = projection.fromLatLngToPoint(new google.maps.LatLng(userPos[0], userPos[1]));
    const offsetX = (offsetPx * Math.sin(headingRad)) / scale;
    const offsetY = (-offsetPx * Math.cos(headingRad)) / scale;
    const centerPoint = new google.maps.Point(riderPoint.x + offsetX, riderPoint.y + offsetY);
    return projection.fromPointToLatLng(centerPoint);
  } catch (e) {
    return new google.maps.LatLng(userPos[0], userPos[1]);
  }
}