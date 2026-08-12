/* global google */
import { useEffect, useRef, useState, useMemo } from 'react';
import { useGoogleMap } from '@react-google-maps/api';
import { haversine, getServiceCategory } from '@/lib/serviceCategories';

const SERVICE_ZOOM_THRESHOLD = 13;
const SERVICE_DISTANCE_KM = 10;
const MARKER_SIZE = 40;

function clusterServices(services, zoom) {
  const precision = zoom >= 15 ? 5 : zoom >= 14 ? 4 : 3;
  const groups = {};
  services.forEach((s) => {
    const key = `${s.lat.toFixed(precision)},${s.lng.toFixed(precision)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  return Object.values(groups).map((items) => {
    if (items.length === 1) return { type: 'single', service: items[0] };
    const avgLat = items.reduce((sum, s) => sum + s.lat, 0) / items.length;
    const avgLng = items.reduce((sum, s) => sum + s.lng, 0) / items.length;
    return { type: 'cluster', count: items.length, lat: avgLat, lng: avgLng };
  });
}

function emojiIconUrl(emoji) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MARKER_SIZE}" height="${MARKER_SIZE}">
    <text x="50%" y="54%" font-size="28" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

/**
 * ServiceMarkers — renders service pins as native google.maps.Marker instances
 * (imperative, outside React's reconciliation) to avoid the floatPane jitter
 * that HTML overlays exhibit during pan/zoom. Same zoom threshold (>=13) and
 * 10km proximity filtering as before. Click triggers the onMarkerClick callback.
 */
export default function ServiceMarkers({ services, userPos, onMarkerClick }) {
  const map = useGoogleMap();
  const [zoom, setZoom] = useState(map?.getZoom() || SERVICE_ZOOM_THRESHOLD);
  const cbRef = useRef(onMarkerClick);
  cbRef.current = onMarkerClick;
  const markersRef = useRef(new Map());

  useEffect(() => {
    if (!map) return;
    setZoom(map.getZoom());
    const onZoom = () => setZoom(map.getZoom());
    const id = map.addListener('zoom_changed', onZoom);
    return () => google.maps.event.removeListener(id);
  }, [map]);

  const items = useMemo(() => {
    if (zoom < SERVICE_ZOOM_THRESHOLD) return [];
    const filtered = userPos
      ? services.filter((s) =>
           s.lat != null && s.lng != null && !isNaN(s.lat) && !isNaN(s.lng) &&
           haversine(userPos[0], userPos[1], s.lat, s.lng) <= SERVICE_DISTANCE_KM)
      : services.filter((s) => s.lat != null && s.lng != null && !isNaN(s.lat) && !isNaN(s.lng));
    return clusterServices(filtered, zoom);
  }, [services, userPos, zoom]);

  useEffect(() => {
    if (!map || !window.google) return;
    const g = window.google;
    const markers = markersRef.current;
    const seen = new Set();

    items.forEach((item) => {
      const isSingle = item.type === 'single';
      const id = isSingle ? `svc-${item.service.id}` : `svc-cluster-${item.lat.toFixed(5)}-${item.lng.toFixed(5)}`;
      seen.add(id);
      const latLng = new g.maps.LatLng(isSingle ? item.service.lat : item.lat, isSingle ? item.service.lng : item.lng);

      let icon;
      if (isSingle) {
        const s = item.service;
        const cat = getServiceCategory(s.category);
        icon = {
          url: s.logo_url || emojiIconUrl(cat.emoji),
          scaledSize: new g.maps.Size(MARKER_SIZE, MARKER_SIZE),
          anchor: new g.maps.Point(MARKER_SIZE / 2, MARKER_SIZE / 2),
        };
      } else {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44">
          <circle cx="22" cy="22" r="19" fill="#FF6F00" stroke="#fff" stroke-width="3"/>
          <text x="50%" y="55%" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle" dominant-baseline="middle">${item.count}</text>
        </svg>`;
        icon = {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
          scaledSize: new g.maps.Size(44, 44),
          anchor: new g.maps.Point(22, 22),
        };
      }

      let m = markers.get(id);
      if (!m) {
        m = new g.maps.Marker({ position: latLng, map, icon, zIndex: 400, optimized: true });
        if (isSingle) {
          m.addListener('click', () => cbRef.current?.(item.service));
        }
        markers.set(id, m);
      } else {
        m.setPosition(latLng);
        m.setIcon(icon);
      }
    });

    for (const [id, m] of markers) {
      if (!seen.has(id)) { m.setMap(null); markers.delete(id); }
    }
  }, [map, items]);

  useEffect(() => () => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current.clear();
  }, []);

  return null;
}