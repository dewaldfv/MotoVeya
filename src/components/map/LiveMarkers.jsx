/* global google */
import { useEffect, useRef } from 'react';
import { useGoogleMap } from '@react-google-maps/api';

/**
 * LiveMarkers — manages the user's own marker, friends, and group-ride participants
 * as NATIVE google.maps.Marker instances, updated imperatively via setPosition().
 *
 * This component returns null — it has no DOM output and never triggers a React
 * re-render of the markers.  Every GPS tick simply calls marker.setPosition() on the
 * existing native marker, so the Google Maps API handles the repositioning in the
 * compositor with zero Virtual DOM diffing.  This is what eliminates the jitter.
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
      fillColor: '#FF6F00',
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

export default function LiveMarkers({ rider, friends = [], groupRiders = [], onFriendClick }) {
  const map = useGoogleMap();
  const markersRef = useRef(new Map());
  const infoWindowsRef = useRef(new Map());
  const dataRef = useRef(new Map());
  const accuracyRef = useRef(null);
  const cbRef = useRef(onFriendClick);
  cbRef.current = onFriendClick;
  // Smooth rider-marker interpolation state.
  const riderAnimRef = useRef(null);
  const riderDisplayRef = useRef(null);
  const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  useEffect(() => {
    if (!map || !window.google) return;
    const g = window.google;
    const markers = markersRef.current;
    const infoWins = infoWindowsRef.current;
    const data = dataRef.current;
    const seen = new Set();

    // --- Rider (self) with smooth interpolation ---
    if (rider && !isNaN(rider.lat) && !isNaN(rider.lng)) {
      const id = 'rider-self';
      seen.add(id);
      const latLng = new g.maps.LatLng(rider.lat, rider.lng);
      const icon = makeIcon(g, 'rider', rider.heading);
      let m = markers.get(id);
      if (!m) {
        m = new g.maps.Marker({ position: latLng, map, icon, zIndex: 1200 });
        markers.set(id, m);
        riderDisplayRef.current = { lat: rider.lat, lng: rider.lng };
      } else {
        m.setIcon(icon);
        // Glide from the currently displayed position toward the new GPS fix.
        if (riderAnimRef.current) cancelAnimationFrame(riderAnimRef.current);
        const start = riderDisplayRef.current || { lat: rider.lat, lng: rider.lng };
        const target = { lat: rider.lat, lng: rider.lng };
        const startTime = performance.now();
        const duration = 700;
        const step = (now) => {
          const t = Math.min(1, (now - startTime) / duration);
          const eased = easeInOutQuad(t);
          riderDisplayRef.current = {
            lat: start.lat + (target.lat - start.lat) * eased,
            lng: start.lng + (target.lng - start.lng) * eased,
          };
          if (m.getMap()) m.setPosition(new g.maps.LatLng(riderDisplayRef.current.lat, riderDisplayRef.current.lng));
          if (t < 1) riderAnimRef.current = requestAnimationFrame(step);
          else riderAnimRef.current = null;
        };
        riderAnimRef.current = requestAnimationFrame(step);
      }
      if (rider.accuracy && rider.accuracy > 0) {
        if (!accuracyRef.current) {
          accuracyRef.current = new g.maps.Circle({
            map, fillColor: '#FF6F00', fillOpacity: 0.08,
            strokeColor: '#FF6F00', strokeOpacity: 0.3, strokeWeight: 1,
          });
        }
        accuracyRef.current.setCenter(latLng);
        accuracyRef.current.setRadius(rider.accuracy);
      } else if (accuracyRef.current) {
        accuracyRef.current.setMap(null);
        accuracyRef.current = null;
      }
    } else {
      const m = markers.get('rider-self');
      if (m) { m.setMap(null); markers.delete('rider-self'); }
      if (accuracyRef.current) { accuracyRef.current.setMap(null); accuracyRef.current = null; }
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
    if (riderAnimRef.current) cancelAnimationFrame(riderAnimRef.current);
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current.clear();
    infoWindowsRef.current.forEach((w) => w.close());
    infoWindowsRef.current.clear();
    dataRef.current.clear();
    if (accuracyRef.current) { accuracyRef.current.setMap(null); accuracyRef.current = null; }
  }, []);

  return null;
}