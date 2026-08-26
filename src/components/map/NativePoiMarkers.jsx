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
  if (isEngen(poi)) {
    // Official Engen-style red e mark + ENGEN wordmark. Keep the complete lockup
    // together; do not invent a replacement logo or distort the proportions.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="25" fill="#fff" stroke="#d71920" stroke-width="2"/>
      <g transform="translate(7 5)">
        <path d="M10 19.5c0-7.2 5.8-13 13-13 5.4 0 10.1 3.3 12 8h-7.4c-1-1.3-2.6-2.2-4.6-2.2-4 0-7.2 3.2-7.2 7.2s3.2 7.2 7.2 7.2c2 0 3.7-.8 4.8-2.2H36c-2 4.7-6.6 8-12.1 8-7.2 0-13-5.8-13-13Z" fill="#d71920"/>
        <path d="M16.1 20c1.1-2.8 3.9-4.8 7.1-4.8 3.4 0 6.2 2.1 7.3 5.1h-6.1c-.4-.6-.9-1-1.8-1-1.2 0-2.2.7-2.7 1.7h-3.8Z" fill="#fff"/>
        <text x="23" y="43" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="7.4" font-weight="800" letter-spacing="0.4" fill="#004b93">ENGEN</text>
      </g>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

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
      const markerIconUrl = markerIcon(poi);
      const icon = {
        url: markerIconUrl,
        scaledSize: new g.maps.Size(46, 46),
        anchor: new g.maps.Point(23, 23),
      };

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
