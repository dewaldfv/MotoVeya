import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapInstance } from '@/lib/maplibreContext';

const CATEGORY = {
  fuel: { color: '#22c55e', emoji: '\u26fd' },
  food: { color: '#f59e0b', emoji: '\ud83c\udf7d\ufe0f' },
  pub: { color: '#a855f7', emoji: '\ud83c\udf7a' },
  workshop: { color: '#3b82f6', emoji: '\ud83d\udd27' },
  dealership: { color: '#06b6d4', emoji: '\ud83c\udfcd\ufe0f' },
  emergency: { color: '#ef4444', emoji: '\u2695\ufe0f' },
  hospital: { color: '#ef4444', emoji: '\u2695\ufe0f' },
  rest_stop: { color: '#64748b', emoji: '\ud83c\udd7f\ufe0f' },
  scenic: { color: '#10b981', emoji: '\ud83c\udfd6\ufe0f' },
  accommodation: { color: '#8b5cf6', emoji: '\ud83d\udecf\ufe0f' },
  atm: { color: '#eab308', emoji: '\ud83d\udcb3' },
};

function esc(value) {
  return String(value ?? '').replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

function markerIconUrl(poi) {
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
  if (customUrl) return { url: customUrl, width: Number(custom.width_px) || 28, height: Number(custom.height_px) || 28 };

  const config = CATEGORY[poi?.category] || CATEGORY.rest_stop;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <path d="M28 3C14.2 3 3 14.2 3 28c0 13.8 11.2 25 25 25s25-11.2 25-25S41.8 3 28 3z" fill="${config.color}" stroke="#fff" stroke-width="4"/>
    <text x="28" y="36" text-anchor="middle" font-size="24" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${esc(config.emoji)}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function clusterIconUrl(count) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38"><circle cx="19" cy="19" r="16" fill="#334155" stroke="#fff" stroke-width="3"/><text x="19" y="24" text-anchor="middle" font-size="13" font-family="Arial,sans-serif" font-weight="700" fill="#fff">${count > 999 ? '999+' : count}</text></svg>`;
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
  const map = useMapInstance();
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
    if (!map) return;
    const markers = markersRef.current;
    const seen = new Set();
    const visible = clusterPois(validPois, zoom);

    visible.forEach((item, index) => {
      const poi = item.poi;
      const id = item.type === 'cluster' ? `poi-cluster-${index}-${item.lat}-${item.lng}` : `poi-${poi.id || `${poi.name}-${poi.lat}-${poi.lng}`}`;
      seen.add(id);

      const isFuel = item.type === 'poi' && poi?.category === 'fuel';
      const iconResult = item.type === 'cluster'
        ? { url: clusterIconUrl(item.items.length), width: 38, height: 38 }
        : (typeof markerIconUrl(poi) === 'string' ? { url: markerIconUrl(poi), width: isFuel ? 30 : 46, height: isFuel ? 30 : 46 } : markerIconUrl(poi));

      const itemLat = item.lat ?? poi.lat;
      const itemLng = item.lng ?? poi.lng;

      let marker = markers.get(id);
      if (!marker) {
        const el = document.createElement('div');
        el.style.cssText = `width:${iconResult.width}px;height:${iconResult.height}px;pointer-events:auto;cursor:pointer;`;
        const img = document.createElement('img');
        img.src = iconResult.url;
        img.style.cssText = `width:100%;height:100%;`;
        img.draggable = false;
        el.appendChild(img);
        el.addEventListener('click', () => {
          if (item.type === 'cluster') map.setZoom(Math.min((map.getZoom() || 12) + 2, 18));
          else callbackRef.current?.(poi);
        });
        marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([itemLng, itemLat])
          .addTo(map);
        markers.set(id, marker);
      } else {
        marker.setLngLat([itemLng, itemLat]);
      }
    });

    for (const [id, marker] of markers) {
      if (!seen.has(id)) { marker.remove(); markers.delete(id); }
    }
  }, [map, validPois, zoom]);

  useEffect(() => {
    if (!map) return;
    const onZoom = () => setZoom(map.getZoom() || 0);
    map.on('zoom', onZoom);
    return () => map.off('zoom', onZoom);
  }, [map]);

  useEffect(() => () => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
  }, []);

  return null;
}