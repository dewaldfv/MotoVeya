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

    validEvents.forEach((ev) => {
      const id = `event-${ev.id}`;
      seen.add(id);

      const markerLat = Number(ev.lat);
      const markerLng = Number(ev.lng);

      const iconUrl = ev.markerIcon || getEventMarkerUrl(ev.category);
      const isFav = favSet.has(ev.id);
      let m = markers.get(id);
      if (!m) {
        const el = document.createElement('div');
        el.style.cssText = 'width:44px;height:44px;pointer-events:auto;cursor:pointer;';
        const inner = document.createElement('div');
        inner.style.cssText = 'position:relative;width:44px;height:44px;';
        const img = document.createElement('img');
        img.src = iconUrl;
        img.style.cssText = 'width:44px;height:44px;';
        img.draggable = false;
        inner.appendChild(img);
        if (isFav) {
          const heart = document.createElement('div');
          heart.textContent = '\u2665';
          heart.style.cssText = 'position:absolute;top:-8px;left:-8px;color:#ef4444;font-size:16px;font-weight:bold;text-shadow:0 1px 2px rgba(0,0,0,0.4);';
          inner.appendChild(heart);
        }
        el.appendChild(inner);
        el.addEventListener('click', () => cbRef.current?.(ev));
        m = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([markerLng, markerLat])
          .addTo(map);
        markers.set(id, m);
      } else {
        m.setLngLat([markerLng, markerLat]);
      }
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