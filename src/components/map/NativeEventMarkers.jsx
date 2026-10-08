import { useEffect, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapInstance } from '@/lib/maplibreContext';
import { getEventMarkerUrl } from '@/lib/eventMarkers';

/**
 * NativeEventMarkers — renders event pins as MapLibre Marker instances.
 * Events are static; positions never change. Includes spiderfying for
 * events at the same location so they remain individually tappable.
 */
export default function NativeEventMarkers({ events = [], favoriteEventIds = [], onEventClick }) {
  const map = useMapInstance();
  const markersRef = useRef(new Map());
  const cbRef = useRef(onEventClick);
  cbRef.current = onEventClick;
  const favSet = useMemo(() => new Set(favoriteEventIds || []), [favoriteEventIds]);

  useEffect(() => {
    if (!map) return;
    const markers = markersRef.current;
    const seen = new Set();

    const validEvents = events.filter((ev) =>
      ev.lat != null && ev.lng != null && !isNaN(ev.lat) && !isNaN(ev.lng)
    );
    const GROUP_RADIUS_METERS = 60;
    const metersBetween = (a, b) => {
      const lat1 = Number(a.lat) * Math.PI / 180;
      const lat2 = Number(b.lat) * Math.PI / 180;
      const dLat = lat2 - lat1;
      const dLng = (Number(b.lng) - Number(a.lng)) * Math.PI / 180;
      const x = dLng * Math.cos((lat1 + lat2) / 2);
      const y = dLat;
      return Math.sqrt(x * x + y * y) * 6371000;
    };

    const groups = [];
    validEvents.forEach((ev) => {
      let group = groups.find((g) => metersBetween(ev, g[0]) <= GROUP_RADIUS_METERS);
      if (!group) { group = []; groups.push(group); }
      group.push(ev);
    });

    groups.forEach((group) => {
      const count = group.length;
      group.forEach((ev, index) => {
        const id = `event-${ev.id}`;
        seen.add(id);

        let markerLat = Number(ev.lat);
        let markerLng = Number(ev.lng);
        if (count > 1) {
          const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
          const radiusMeters = count <= 4 ? 28 : 34;
          const metersPerDegreeLat = 111320;
          const metersPerDegreeLng = 111320 * Math.cos(markerLat * Math.PI / 180);
          markerLat += (Math.sin(angle) * radiusMeters) / metersPerDegreeLat;
          markerLng += (Math.cos(angle) * radiusMeters) / metersPerDegreeLng;
        }

        const iconUrl = ev.markerIcon || getEventMarkerUrl(ev.category);
        const isFav = favSet.has(ev.id);
        let m = markers.get(id);
        if (!m) {
          const el = document.createElement('div');
          el.style.cssText = 'width:44px;height:44px;pointer-events:auto;cursor:pointer;position:relative;';
          const img = document.createElement('img');
          img.src = iconUrl;
          img.style.cssText = 'width:44px;height:44px;';
          img.draggable = false;
          el.appendChild(img);
          if (isFav) {
            const heart = document.createElement('div');
            heart.textContent = '\u2665';
            heart.style.cssText = 'position:absolute;top:-8px;left:-8px;color:#ef4444;font-size:16px;font-weight:bold;text-shadow:0 1px 2px rgba(0,0,0,0.4);';
            el.appendChild(heart);
          }
          el.addEventListener('click', () => cbRef.current?.(ev));
          m = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([markerLng, markerLat])
            .addTo(map);
          markers.set(id, m);
        } else {
          m.setLngLat([markerLng, markerLat]);
        }
      });
    });

    for (const [id, m] of markers) {
      if (!seen.has(id)) { m.remove(); markers.delete(id); }
    }
  }, [map, events, favSet]);

  useEffect(() => () => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
  }, []);

  return null;
}