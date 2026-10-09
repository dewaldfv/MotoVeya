import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapInstance, useMapStyleVersion } from '@/lib/maplibreContext';
import { circlePolygon } from '@/lib/maplibreUtils';

/**
 * LiveMarkers — manages the user's own marker, friends, and group-ride
 * participants as MapLibre Marker instances, updated imperatively via
 * setLngLat(). A continuous requestAnimationFrame loop eases the rider
 * marker toward the latest GPS target, absorbing position noise.
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

function riderSvg(heading, isCrashRecovery) {
  const color = isCrashRecovery ? '#ef4444' : '#FF6F00';
  return `<svg width="28" height="28" viewBox="0 0 24 24" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round" style="transform:rotate(${heading || 0}deg);transition:transform 0.3s ease"><path d="M12 2 L20 20 L12 16 L4 20 Z"/></svg>`;
}

function circleElement(color, size = 14) {
  const el = document.createElement('div');
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);pointer-events:auto;cursor:pointer;`;
  return el;
}

const ACC_SRC = 'live-rider-accuracy';
const ACC_FILL = 'live-rider-accuracy-fill';
const ACC_LINE = 'live-rider-accuracy-line';

export default function LiveMarkers({ rider, friends = [], groupRiders = [], onFriendClick, headingUp = false }) {
  const map = useMapInstance();
  const styleVersion = useMapStyleVersion();
  const markersRef = useRef(new Map());
  const popupsRef = useRef(new Map());
  const dataRef = useRef(new Map());
  const accuracyReadyRef = useRef(false);
  const riderTargetRef = useRef(null);
  const riderRafRef = useRef(null);
  const cbRef = useRef(onFriendClick);
  cbRef.current = onFriendClick;

  // Ensure accuracy source/layers exist (re-create after style change)
  useEffect(() => {
    if (!map) return;
    if (!map.getSource(ACC_SRC)) {
      map.addSource(ACC_SRC, {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] } },
      });
      map.addLayer({ id: ACC_FILL, type: 'fill', source: ACC_SRC, paint: { 'fill-color': '#FF6F00', 'fill-opacity': 0.08 } });
      map.addLayer({ id: ACC_LINE, type: 'line', source: ACC_SRC, paint: { 'line-color': '#FF6F00', 'line-opacity': 0.3, 'line-width': 1 } });
    }
    accuracyReadyRef.current = true;
    return () => {
      try {
        if (map.getLayer(ACC_FILL)) map.removeLayer(ACC_FILL);
        if (map.getLayer(ACC_LINE)) map.removeLayer(ACC_LINE);
        if (map.getSource(ACC_SRC)) map.removeSource(ACC_SRC);
      } catch {}
      accuracyReadyRef.current = false;
    };
  }, [map, styleVersion]);

  // Continuous smooth-interpolation loop for the rider marker.
  // Uses velocity-based prediction: between GPS fixes the target keeps
  // moving along the last computed velocity vector, so the marker glides
  // instead of stop-and-go jumping on each fix.
  useEffect(() => {
    if (!map) return;
    const animate = () => {
      const m = markersRef.current.get('rider-self');
      const target = riderTargetRef.current;
      if (m && target) {
        const now = performance.now();
        // Only project forward when genuinely moving. When stationary, GPS
        // jitter produces tiny velocity vectors that keep nudging the marker
        // in random directions, so we anchor to the last reported fix.
        const moving = (target.velLat || 0) !== 0 || (target.velLng || 0) !== 0;
        const elapsed = moving ? Math.min(1.0, (now - (target.t || now)) / 1000) : 0;
        const predLat = target.lat + (target.velLat || 0) * elapsed;
        const predLng = target.lng + (target.velLng || 0) * elapsed;
        const ll = m.getLngLat();
        const curLat = ll?.lat ?? predLat;
        const curLng = ll?.lng ?? predLng;
        const newLat = curLat + (predLat - curLat) * 0.22;
        const newLng = curLng + (predLng - curLng) * 0.22;
        m.setLngLat([newLng, newLat]);
        if (accuracyReadyRef.current && target.accuracy > 0) {
          const src = map.getSource(ACC_SRC);
          if (src) src.setData(circlePolygon(newLat, newLng, target.accuracy));
        }
      }
      riderRafRef.current = requestAnimationFrame(animate);
    };
    riderRafRef.current = requestAnimationFrame(animate);
    return () => {
      if (riderRafRef.current) cancelAnimationFrame(riderRafRef.current);
      riderRafRef.current = null;
    };
  }, [map]);

  // Sync markers with data
  useEffect(() => {
    if (!map) return;
    const markers = markersRef.current;
    const popups = popupsRef.current;
    const data = dataRef.current;
    const seen = new Set();

    // --- Rider (self) ---
    if (rider && !isNaN(rider.lat) && !isNaN(rider.lng)) {
      const id = 'rider-self';
      seen.add(id);
      const screenHeading = headingUp ? 0 : rider.heading;
      const isCrashRecovery = !!rider.isCrashRecovery;
      let m = markers.get(id);
      if (!m) {
        const el = document.createElement('div');
        el.style.pointerEvents = 'auto';
        el.innerHTML = riderSvg(screenHeading, isCrashRecovery);
        m = new maplibregl.Marker({ element: el })
          .setLngLat([rider.lng, rider.lat])
          .addTo(map);
        markers.set(id, m);
        riderTargetRef.current = { lat: rider.lat, lng: rider.lng, accuracy: rider.accuracy || 0, velLat: 0, velLng: 0, t: performance.now() };
      } else {
        m.getElement().innerHTML = riderSvg(screenHeading, isCrashRecovery);
        const prev = riderTargetRef.current;
        let velLat = 0, velLng = 0;
        if (prev && prev.lat != null) {
          const dt = (performance.now() - (prev.t || 0)) / 1000;
          if (dt > 0.1 && dt < 5) {
            // Reject movement that falls within GPS noise: if the displacement
            // is smaller than the reported accuracy (or a 5 m floor), treat
            // the phone as stationary and carry zero velocity forward so the
            // marker stays put instead of drifting with the jitter.
            const dLat = rider.lat - prev.lat;
            const dLng = rider.lng - prev.lng;
            const meters = Math.hypot(dLat * 111000, dLng * 111000 * Math.cos((rider.lat * Math.PI) / 180));
            const noiseFloor = Math.max(5, rider.accuracy || prev.accuracy || 0);
            if (meters >= noiseFloor) {
              velLat = Math.max(-0.0008, Math.min(0.0008, dLat / dt));
              velLng = Math.max(-0.0008, Math.min(0.0008, dLng / dt));
            }
          }
        }
        riderTargetRef.current = { lat: rider.lat, lng: rider.lng, accuracy: rider.accuracy || 0, velLat, velLng, t: performance.now() };
      }
    } else {
      const m = markers.get('rider-self');
      if (m) { m.remove(); markers.delete('rider-self'); }
      riderTargetRef.current = null;
      if (accuracyReadyRef.current) {
        const src = map.getSource(ACC_SRC);
        if (src) src.setData({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [] } });
      }
    }

    // --- Friends ---
    friends.forEach((f) => {
      if (f.lat == null || f.lng == null || isNaN(f.lat) || isNaN(f.lng)) return;
      const id = `friend-${f.user_id || f.id}`;
      seen.add(id);
      data.set(id, f);
      const color = friendColor(f);
      let m = markers.get(id);
      if (!m) {
        const el = circleElement(color, 14);
        el.addEventListener('click', () => cbRef.current?.(data.get(id)));
        m = new maplibregl.Marker({ element: el })
          .setLngLat([f.lng, f.lat])
          .addTo(map);
        markers.set(id, m);
      } else {
        m.setLngLat([f.lng, f.lat]);
        m.getElement().style.background = color;
      }
    });

    // --- Group riders ---
    groupRiders.forEach((gr) => {
      if (gr.lat == null || gr.lng == null || isNaN(gr.lat) || isNaN(gr.lng)) return;
      const id = `group-${gr.user_id}`;
      seen.add(id);
      data.set(id, gr);
      const color = groupColor(gr);
      let m = markers.get(id);
      if (!m) {
        const el = circleElement(color, 16);
        el.addEventListener('click', () => {
          const latest = data.get(id) || gr;
          let popup = popups.get(id);
          if (!popup) {
            popup = new maplibregl.Popup({ offset: 20, closeButton: true });
            popups.set(id, popup);
          }
          const role = latest.role === 'leader' ? 'Leader' : latest.role === 'sweep' ? 'Sweep' : 'Member';
          const status = (latest.riding_status || 'stopped').replace('_', ' ');
          const speed = latest.speed_kmh != null ? `${Math.round(latest.speed_kmh)} km/h` : '';
          popup.setHTML(
            `<div style="font-family:Inter,sans-serif;padding:6px 8px;min-width:150px">` +
              `<div style="font-weight:700;font-size:14px;margin-bottom:2px">${latest.user_name || 'Rider'}</div>` +
              `<div style="font-size:12px;color:#666">${role} \u00b7 ${status}</div>` +
              (speed ? `<div style="font-size:12px;color:#666">${speed}</div>` : '') +
            `</div>`
          ).setLngLat([latest.lng, latest.lat]).addTo(map);
        });
        m = new maplibregl.Marker({ element: el })
          .setLngLat([gr.lng, gr.lat])
          .addTo(map);
        markers.set(id, m);
      } else {
        m.setLngLat([gr.lng, gr.lat]);
        m.getElement().style.background = color;
      }
    });

    // Remove markers no longer present
    for (const [id, m] of markers) {
      if (!seen.has(id)) {
        m.remove();
        const p = popups.get(id);
        if (p) { p.remove(); popups.delete(id); }
        data.delete(id);
        markers.delete(id);
      }
    }
  }, [map, rider, friends, groupRiders, headingUp]);

  // Cleanup on unmount
  useEffect(() => () => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
    if (riderRafRef.current) cancelAnimationFrame(riderRafRef.current);
    riderRafRef.current = null;
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current.clear();
    dataRef.current.clear();
  }, []);

  return null;
}