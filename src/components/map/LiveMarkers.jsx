/* global google */
import { useEffect, useRef } from 'react';
import { useGoogleMap } from '@react-google-maps/api';

/**
 * LiveMarkers — manages the user's own marker, friends, and group-ride participants
 * as NATIVE google.maps.Marker instances, updated imperatively via setPosition().
 *
 * This component returns null — it has no DOM output and never triggers a React
 * re-render of the markers.  Every GPS tick simply updates a target ref; a
 * continuous requestAnimationFrame loop eases the rider marker toward the latest
 * target.  This eliminates the cancel/restart jitter that occurred when each
 * GPS fix cancelled a running animation and started a new one.
 */
const FRIEND_COLORS = { riding: '#22c55e', stopped: '#94a3b8', distress: '#ef4444' };

function friendColor(f) {
  if (f.is_distress) return FRIEND_COLORS.distress;
  return f.speed_kmh > 5 ? FRIEND_COLORS.riding : FRIEND_COLORS.stopped;
}

function groupColor(g) {
  if (g.riding_status === 'emergency') return '#ef4444';
  if (g.role === 'leader') return '#FF6F00';
  if (g.role === 'sweep') return '#a855f7';
  return '#3b82f6';
}

function makeIcon(g, type, heading, color) {
  if (type === 'rider') {
    return {
      path: g.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      fillColor: g.__motoveyaCrashRecovery ? '#ef4444' : '#FF6F00',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: 4,
      rotation: heading || 0,
    };
  }
  return {
    path: g.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: type === 'group' ? 8 : 7,
  };
}

export default function LiveMarkers({ rider, friends = [], groupRiders = [], onFriendClick, headingUp = false }) {
  const map = useGoogleMap();
  const markersRef = useRef(new Map());
  const infoWindowsRef = useRef(new Map());
  const dataRef = useRef(new Map());
  const accuracyRef = useRef(null);
  const riderTargetRef = useRef(null);
  const riderRafRef = useRef(null);
  const cbRef = useRef(onFriendClick);
  cbRef.current = onFriendClick;

  // Continuous smooth-interpolation loop for the rider marker.  Instead of
  // cancelling and restarting an animation on every GPS tick (which caused
  // visible jitter), this loop runs constantly and eases the marker 15% of
  // the remaining gap toward the latest target every frame.  The easing itself
  // acts as a low-pass filter that absorbs GPS position noise.
  useEffect(() => {
    if (!map || !window.google) return;
    const g = window.google;
    let lastHeading = null;
    const animate = () => {
      const m = markersRef.current.get('rider-self');
      const target = riderTargetRef.current;
      if (m && target) {
        const cur = m.getPosition();
        const curLat = cur?.lat?.() ?? target.lat;
        const curLng = cur?.lng?.() ?? target.lng;
        const newLat = curLat + (target.lat - curLat) * 0.15;
        const newLng = curLng + (target.lng - curLng) * 0.15;
        const newPos = new g.maps.LatLng(newLat, newLng);
        m.setPosition(newPos);
        if (accuracyRef.current) accuracyRef.current.setCenter(newPos);
      }
      riderRafRef.current = requestAnimationFrame(animate);
    };
    riderRafRef.current = requestAnimationFrame(animate);
    return () => {
      if (riderRafRef.current) cancelAnimationFrame(riderRafRef.current);
      riderRafRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (!map || !window.google) return;
    const g = window.google;
    const markers = markersRef.current;
    const infoWins = infoWindowsRef.current;
    const data = dataRef.current;
    const seen = new Set();

    // --- Rider (self) ---
    // The marker target is updated here; the continuous RAF loop above
    // handles the actual smooth position interpolation.
    if (rider && !isNaN(rider.lat) && !isNaN(rider.lng)) {
      const id = 'rider-self';
      seen.add(id);
      g.__motoveyaCrashRecovery = !!rider.isCrashRecovery;
      // In heading-up Ride Mode the camera already points in the travel direction,
      // so the rider arrow stays screen-up. In north-up mode it follows the actual heading.
      const screenHeading = headingUp ? 0 : rider.heading;
      const icon = makeIcon(g, 'rider', screenHeading);
      let m = markers.get(id);
      if (!m) {
        const latLng = new g.maps.LatLng(rider.lat, rider.lng);
        m = new g.maps.Marker({ position: latLng, map, icon, zIndex: 1200 });
        markers.set(id, m);
        riderTargetRef.current = { lat: rider.lat, lng: rider.lng };
      } else {
        m.setIcon(icon);
        riderTargetRef.current = { lat: rider.lat, lng: rider.lng };
      }
      if (rider.accuracy && rider.accuracy > 0) {
        if (!accuracyRef.current) {
          accuracyRef.current = new g.maps.Circle({
            map, fillColor: '#FF6F00', fillOpacity: 0.08,
            strokeColor: '#FF6F00', strokeOpacity: 0.3, strokeWeight: 1,
          });
        }
        accuracyRef.current.setRadius(rider.accuracy);
      } else if (accuracyRef.current) {
        accuracyRef.current.setMap(null);
        accuracyRef.current = null;
      }
    } else {
      const m = markers.get('rider-self');
      if (m) { m.setMap(null); markers.delete('rider-self'); }
      if (accuracyRef.current) { accuracyRef.current.setMap(null); accuracyRef.current = null; }
      riderTargetRef.current = null;
    }

    // --- Friends ---
    friends.forEach((f) => {
      if (f.lat == null || f.lng == null || isNaN(f.lat) || isNaN(f.lng)) return;
      const id = `friend-${f.user_id || f.id}`;
      seen.add(id);
      data.set(id, f);
      const latLng = new g.maps.LatLng(f.lat, f.lng);
      const color = friendColor(f);
      let m = markers.get(id);
      if (!m) {
        m = new g.maps.Marker({ position: latLng, map, icon: makeIcon(g, 'friend', null, color), zIndex: 1000 });
        m.addListener('click', () => cbRef.current?.(data.get(id)));
        markers.set(id, m);
      } else {
        m.setPosition(latLng);
        m.setIcon(makeIcon(g, 'friend', null, color));
      }
    });

    // --- Group riders ---
    groupRiders.forEach((gr) => {
      if (gr.lat == null || gr.lng == null || isNaN(gr.lat) || isNaN(gr.lng)) return;
      const id = `group-${gr.user_id}`;
      seen.add(id);
      data.set(id, gr);
      const latLng = new g.maps.LatLng(gr.lat, gr.lng);
      const color = groupColor(gr);
      let m = markers.get(id);
      if (!m) {
        m = new g.maps.Marker({ position: latLng, map, icon: makeIcon(g, 'group', null, color), zIndex: 1100 });
        m.addListener('click', () => {
          let win = infoWins.get(id);
          if (!win) { win = new g.maps.InfoWindow(); infoWins.set(id, win); }
          const latest = data.get(id) || gr;
          const role = latest.role === 'leader' ? 'Leader' : latest.role === 'sweep' ? 'Sweep' : 'Member';
          const status = (latest.riding_status || 'stopped').replace('_', ' ');
          const speed = latest.speed_kmh != null ? `${Math.round(latest.speed_kmh)} km/h` : '';
          win.setContent(
            `<div style="font-family:Inter,sans-serif;padding:6px 8px;min-width:150px">` +
              `<div style="font-weight:700;font-size:14px;margin-bottom:2px">${latest.user_name || 'Rider'}</div>` +
              `<div style="font-size:12px;color:#666">${role} · ${status}</div>` +
              (speed ? `<div style="font-size:12px;color:#666">${speed}</div>` : '') +
            `</div>`
          );
          win.open(map, m);
        });
        markers.set(id, m);
      } else {
        m.setPosition(latLng);
        m.setIcon(makeIcon(g, 'group', null, color));
      }
    });

    // --- Remove markers no longer present ---
    for (const [id, m] of markers) {
      if (!seen.has(id)) {
        m.setMap(null);
        const win = infoWins.get(id);
        if (win) { win.close(); infoWins.delete(id); }
        data.delete(id);
        markers.delete(id);
      }
    }
  }, [map, rider, friends, groupRiders]);

  // Cleanup on unmount
  useEffect(() => () => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current.clear();
    if (riderRafRef.current) cancelAnimationFrame(riderRafRef.current);
    riderRafRef.current = null;
    infoWindowsRef.current.forEach((w) => w.close());
    infoWindowsRef.current.clear();
    dataRef.current.clear();
    if (accuracyRef.current) { accuracyRef.current.setMap(null); accuracyRef.current = null; }
  }, []);

  return null;
}