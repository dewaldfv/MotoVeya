/* global google */
import { useEffect, useMemo, useRef, useState } from 'react';
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
  // Fuel stations always use the dedicated MotoVeya petrol-pump symbol.
  if (poi?.category === 'fuel') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <g fill="none" stroke="#FFA500" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="2" width="60" height="60" rx="13"/>
        <path d="M22 53V12h17v41"/>
        <path d="M22 12h17v14H22z" fill="#FFA500"/>
        <path d="M39 17l9 8c2 1.8 3 4.4 3 7v16"/>
        <path d="M51 48c0 3.3-2.7 6-6 6h-2c-3.3 0-6-2.7-6-6V29h2c3.3 0 6 2.7 6 6v13"/>
        <path d="M14 54h34"/>
      </g>
      <rect x="25" y="18" width="11" height="9" fill="#fff"/>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  const custom = poi?._marker;
  const customUrl = custom?.image_data || custom?.image_url;
  if (customUrl) return {
    url: customUrl,
    scaledSize: new google.maps.Size(Number(custom.width_px) || 28, Number(custom.height_px) || 28),
    anchor: new google.maps.Point(Number(custom.anchor_x) || 14, Number(custom.anchor_y) || 14),
  };

  const config = CATEGORY[poi?.category] || CATEGORY.rest_stop;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <path d="M28 3C14.2 3 3 14.2 3 28c0 13.8 11.2 25 25 25s25-11.2 25-25S41.8 3 28 3z" fill="${config.color}" stroke="#fff" stroke-width="4"/>
    <text x="28" y="36" text-anchor="middle" font-size="24" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${esc(config.emoji)}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function clusterPois(pois, zoom) {
  if (zoom >= 14 || pois.length < 2) return pois.map((poi) => ({ type: 'poi', poi }));
  const radiusMeters = zoom < 11 ? 1800 : zoom < 12 ? 1000 : zoom < 13 ? 500 : 180;
  const clusters = [];
  pois.forEach((poi) => {
    const existing = clusters.find((c) => {
      const dLat = (poi.lat - c.lat) * 111320;
      const dLng = (poi.lng - c.lng) * 111320 * Math.cos(poi.lat * Math.PI / 180);
      return Math.sqrt(dLat * dLat + dLng * dLng) <= radiusMeters;
    });
    if (existing) {
      existing.items.push(poi);
      const n = existing.items.length;
      existing.lat = (existing.lat * (n - 1) + poi.lat) / n;
      existing.lng = (existing.lng * (n - 1) + poi.lng) / n;
    } else clusters.push({ lat: poi.lat, lng: poi.lng, items: [poi] });
  });
  return clusters.map((c) => c.items.length === 1 ? { type: 'poi', poi: c.items[0] } : { type: 'cluster', ...c });
}

function clusterIcon(count) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38"><circle cx="19" cy="19" r="16" fill="#334155" stroke="#fff" stroke-width="3"/><text x="19" y="24" text-anchor="middle" font-size="13" font-family="Arial,sans-serif" font-weight="700" fill="#fff">${count > 999 ? '999+' : count}</text></svg>`;
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
  const [zoom, setZoom] = useState(() => map?.getZoom() || 0);
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
    const visible = clusterPois(validPois, zoom);

    visible.forEach((item, index) => {
      const poi = item.poi;
      const id = item.type === 'cluster' ? `poi-cluster-${index}-${item.lat}-${item.lng}` : `poi-${poi.id || `${poi.name}-${poi.lat}-${poi.lng}`}`;
      seen.add(id);
      const iconConfig = item.type === 'cluster' ? { url: clusterIcon(item.items.length), scaledSize: new g.maps.Size(38, 38), anchor: new g.maps.Point(19, 19) } : markerIcon(poi);
      const icon = iconConfig ? (typeof iconConfig === 'string' ? {
        url: iconConfig,
        scaledSize: new g.maps.Size(item.type === 'poi' && poi?.category === 'fuel' ? 30 : 46, item.type === 'poi' && poi?.category === 'fuel' ? 30 : 46),
        anchor: new g.maps.Point(item.type === 'poi' && poi?.category === 'fuel' ? 15 : 23, item.type === 'poi' && poi?.category === 'fuel' ? 15 : 23),
      } : iconConfig) : undefined;

      let marker = markers.get(id);
      if (!marker) {
        marker = new g.maps.Marker({
          map,
          position: { lat: item.lat ?? poi.lat, lng: item.lng ?? poi.lng },
          icon,
          title: item.type === 'cluster' ? `${item.items.length} POIs` : (poi.name || poi.category || 'POI'),
          zIndex: item.type === 'cluster' ? 550 : (isEngen(poi) ? 650 : 600),
          optimized: true,
        });
        marker.addListener('click', () => {
          if (item.type === 'cluster') map.setZoom(Math.min((map.getZoom() || 12) + 2, 18));
          else callbackRef.current?.(poi);
        });
        markers.set(id, marker);
      } else {
        marker.setMap(map);
        marker.setPosition({ lat: item.lat ?? poi.lat, lng: item.lng ?? poi.lng });
        marker.setIcon(icon);
        marker.setTitle(item.type === 'cluster' ? `${item.items.length} POIs` : (poi.name || poi.category || 'POI'));
        marker.setZIndex(item.type === 'cluster' ? 550 : (isEngen(poi) ? 650 : 600));
      }
    });

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.setMap(null);
        markers.delete(id);
      }
    }
  }, [map, validPois, zoom]);

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('zoom_changed', () => setZoom(map.getZoom() || 0));
    return () => window.google?.maps?.event?.removeListener(listener);
  }, [map]);

  useEffect(() => () => {
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();
  }, []);

  return null;
}
