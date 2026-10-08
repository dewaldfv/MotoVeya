import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapInstance } from '@/lib/maplibreContext';

const OWN_ICON = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 24 16 24s16-12 16-24C32 7.2 24.8 0 16 0z" fill="#FF6F00" stroke="#fff" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#fff"/></svg>`
);

const GROUP_ICON = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.3 0 0 6.3 0 14c0 10 14 22 14 22s14-12 14-22C28 6.3 21.7 0 14 0z" fill="#64748b" stroke="#fff" stroke-width="2"/><circle cx="14" cy="14" r="4" fill="#fff"/></svg>`
);

/**
 * SavedPlaceMarkers — renders Saved Place pins as MapLibre Marker instances.
 * Own places use a primary orange pin; group members' places use a muted pin.
 */
export default function SavedPlaceMarkers({ ownPlaces = [], groupPlaces = [], visible = true, onOwnClick, onGroupClick }) {
  const map = useMapInstance();
  const markersRef = useRef(new Map());
  const ownCbRef = useRef(onOwnClick);
  const groupCbRef = useRef(onGroupClick);
  ownCbRef.current = onOwnClick;
  groupCbRef.current = onGroupClick;

  useEffect(() => {
    if (!map) return;

    if (!visible) {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      return;
    }

    const markers = markersRef.current;
    const seen = new Set();

    ownPlaces.forEach((place) => {
      if (place.lat == null || place.lng == null || isNaN(place.lat) || isNaN(place.lng)) return;
      const id = `own-saved-${place.id}`;
      seen.add(id);
      let m = markers.get(id);
      if (!m) {
        const el = document.createElement('div');
        el.style.cssText = 'width:32px;height:40px;pointer-events:auto;cursor:pointer;';
        const img = document.createElement('img');
        img.src = OWN_ICON;
        img.style.cssText = 'width:32px;height:40px;';
        img.draggable = false;
        el.appendChild(img);
        el.addEventListener('click', () => ownCbRef.current?.(place));
        m = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([Number(place.lng), Number(place.lat)])
          .addTo(map);
        markers.set(id, m);
      } else {
        m.setLngLat([Number(place.lng), Number(place.lat)]);
      }
    });

    groupPlaces.forEach((place) => {
      if (place.lat == null || place.lng == null || isNaN(place.lat) || isNaN(place.lng)) return;
      const id = `group-saved-${place.id}`;
      seen.add(id);
      let m = markers.get(id);
      if (!m) {
        const el = document.createElement('div');
        el.style.cssText = 'width:28px;height:36px;pointer-events:auto;cursor:pointer;';
        const img = document.createElement('img');
        img.src = GROUP_ICON;
        img.style.cssText = 'width:28px;height:36px;';
        img.draggable = false;
        el.appendChild(img);
        el.addEventListener('click', () => groupCbRef.current?.(place));
        m = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([Number(place.lng), Number(place.lat)])
          .addTo(map);
        markers.set(id, m);
      } else {
        m.setLngLat([Number(place.lng), Number(place.lat)]);
      }
    });

    for (const [id, m] of markers) {
      if (!seen.has(id)) { m.remove(); markers.delete(id); }
    }
  }, [map, ownPlaces, groupPlaces, visible]);

  useEffect(() => () => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
  }, []);

  return null;
}