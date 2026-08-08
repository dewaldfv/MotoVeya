/* global google */
import { useEffect, useRef, useMemo } from 'react';
import { useGoogleMap } from '@react-google-maps/api';
import { getEventMarkerUrl } from '@/lib/eventMarkers';

/**
 * NativeEventMarkers — renders event pins as native google.maps.Marker instances.
 * Events are static (positions never change), but using native markers keeps them
 * outside React's reconciliation tree for consistency and reduced overlay overhead.
 * Click triggers the same popup callback the React overlay used.
 */
export default function NativeEventMarkers({ events = [], favoriteEventIds = [], onEventClick }) {
  const map = useGoogleMap();
  const markersRef = useRef(new Map());
  const cbRef = useRef(onEventClick);
  cbRef.current = onEventClick;
  const favSet = useMemo(() => new Set(favoriteEventIds || []), [favoriteEventIds]);

  useEffect(() => {
    if (!map || !window.google) return;
    const g = window.google;
    const markers = markersRef.current;
    const seen = new Set();

    events.forEach((ev) => {
      if (ev.lat == null || ev.lng == null || isNaN(ev.lat) || isNaN(ev.lng)) return;
      const id = `event-${ev.id}`;
      seen.add(id);
      const latLng = new g.maps.LatLng(ev.lat, ev.lng);
      const isFav = favSet.has(ev.id);
      const icon = {
        url: ev.markerIcon || getEventMarkerUrl(ev.category),
        scaledSize: new g.maps.Size(44, 44),
        anchor: new g.maps.Point(22, 22),
        labelOrigin: isFav ? new g.maps.Point(-14, -14) : null,
      };
      let m = markers.get(id);
      if (!m) {
        m = new g.maps.Marker({ position: latLng, map, icon, zIndex: 500 });
        m.addListener('click', () => cbRef.current?.(ev));
        markers.set(id, m);
      } else {
        m.setPosition(latLng);
        m.setIcon(icon);
      }
      if (isFav) {
        m.setLabel({ text: '♥', color: '#ef4444', fontSize: '16px', fontWeight: 'bold' });
      } else {
        m.setLabel(null);
      }
    });

    for (const [id, m] of markers) {
      if (!seen.has(id)) { m.setMap(null); markers.delete(id); }
    }
  }, [map, events, favSet]);

  useEffect(() => () => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current.clear();
  }, []);

  return null;
}