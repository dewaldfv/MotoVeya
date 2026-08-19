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

    // Group events that are effectively at the same physical location, then
    // "spiderfy" only those markers so they remain individually tappable.
    // The stored event coordinates are never changed — this is visual only.
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
      if (!group) {
        group = [];
        groups.push(group);
      }
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
        // Keep the offsets small (roughly 28m radius) and arrange them around
        // the real location. This prevents same-location event pins from
        // covering one another while keeping the cluster visually obvious.
        const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
        const radiusMeters = count <= 4 ? 28 : 34;
        const metersPerDegreeLat = 111320;
        const metersPerDegreeLng = 111320 * Math.cos(markerLat * Math.PI / 180);
        markerLat += (Math.sin(angle) * radiusMeters) / metersPerDegreeLat;
        markerLng += (Math.cos(angle) * radiusMeters) / metersPerDegreeLng;
      }

      const latLng = new g.maps.LatLng(markerLat, markerLng);
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