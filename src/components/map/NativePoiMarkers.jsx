/* global google */
import { useEffect, useMemo, useRef } from 'react';
import { useGoogleMap } from '@react-google-maps/api';

const CATEGORY = {
  fuel: { color: '#22c55e', emoji: '⛽' },
  food: { color: '#f59e0b', emoji: '🍽️' },
  pub: { color: '#a855f7', emoji: '🍺' },
  workshop: { color: '#3b82f6', emoji: '🔧' },
  dealership: { color: '#06b6d4', emoji: '🏍️' },
  emergency: { color: '#ef4444', emoji: '⚕️' },
  hospital: { color: '#ef4444', emoji: '⚕️' },
  rest_stop: { color: '#64748b', emoji: '🅿️' },
  scenic: { color: '#10b981', emoji: '🏔️' },
  accommodation: { color: '#8b5cf6', emoji: '🛏️' },
  atm: { color: '#eab308', emoji: '💳' },
};

function esc(value) {
  return String(value ?? '').replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

function isEngen(poi) {
  return /engen/i.test(`${poi?.name || ''} ${poi?.brand || ''} ${poi?.operator || ''}`);
}

function markerIcon(poi) {
  if (isEngen(poi)) return undefined;

  const config = CATEGORY[poi?.category] || CATEGORY.rest_stop;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <path d="M28 3C14.2 3 3 14.2 3 28c0 13.8 11.2 25 25 25s25-11.2 25-25S41.8 3 28 3z" fill="${config.color}" stroke="#fff" stroke-width="4"/>
    <text x="28" y="36" text-anchor="middle" font-size="24" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${esc(config.emoji)}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function dedupePois(pois) {
  const seen = new Set();
  return pois.filter((poi) => {
    const lat = Number(poi.lat);
    const lng = Number(poi.lng);
    const key = poi.source_id
      ? `source:${poi.source_id}`
      : `${String(poi.name || '').trim().toLowerCase()}|${lat.toFixed(5)}|${lng.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function NativePoiMarkers({ pois = [], onPoiClick }) {
  const map = useGoogleMap();
  const markersRef = useRef(new Map());
  const callbackRef = useRef(onPoiClick);
  callbackRef.current = onPoiClick;

  const validPois = useMemo(() => dedupePois(
    pois
      .map((poi) => ({ ...poi, lat: Number(poi.lat), lng: Number(poi.lng) }))
      .filter((poi) => Number.isFinite(poi.lat) && Number.isFinite(poi.lng) && Math.abs(poi.lat) <= 90 && Math.abs(poi.lng) <= 180)
  ), [pois]);

  useEffect(() => {
    if (!map || !window.google?.maps) return;
    const g = window.google;
    const markers = markersRef.current;
    const seen = new Set();

    validPois.forEach((poi) => {
      const id = `poi-${poi.id || `${poi.name}-${poi.lat}-${poi.lng}`}`;
      seen.add(id);
      const iconUrl = markerIcon(poi);
      const icon = iconUrl ? {
        url: iconUrl,
        scaledSize: new g.maps.Size(46, 46),
        anchor: new g.maps.Point(23, 23),
      } : undefined;

      let marker = markers.get(id);
      if (!marker) {
        marker = new g.maps.Marker({
          map,
          position: { lat: poi.lat, lng: poi.lng },
          icon,
          title: poi.name || poi.category || 'POI',
          zIndex: isEngen(poi) ? 650 : 600,
          optimized: true,
        });
        marker.addListener('click', () => callbackRef.current?.(poi));
        markers.set(id, marker);
      } else {
        marker.setMap(map);
        marker.setPosition({ lat: poi.lat, lng: poi.lng });
        marker.setIcon(icon);
        marker.setTitle(poi.name || poi.category || 'POI');
        marker.setZIndex(isEngen(poi) ? 650 : 600);
      }
    });

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.setMap(null);
        markers.delete(id);
      }
    }
  }, [map, validPois]);

  useEffect(() => () => {
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();
  }, []);

  return null;
}
