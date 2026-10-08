import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapInstance } from '@/lib/maplibreContext';

const MIN_ZOOM = 13;

const FUEL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
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
const ICON_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(FUEL_SVG)}`;

function validStation(station) {
  const lat = Number(station.lat);
  const lng = Number(station.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export default function FuelStationMarkers({ stations = [], onMarkerClick }) {
  const map = useMapInstance();
  const markersRef = useRef(new Map());
  const callbackRef = useRef(onMarkerClick);
  const [zoom, setZoom] = useState(() => map?.getZoom() || 0);
  callbackRef.current = onMarkerClick;

  const validStations = useMemo(() => stations.filter(validStation), [stations]);

  useEffect(() => {
    if (!map) return;
    const markers = markersRef.current;
    const visible = zoom > 12 ? validStations : [];
    const seen = new Set();

    visible.forEach((station) => {
      const id = station.id || `fuel-${station.lat}-${station.lng}`;
      seen.add(id);
      const position = { lat: Number(station.lat), lng: Number(station.lng) };
      const logoUrl = station.logo_url || station.marker_logo_url;
      const iconUrl = logoUrl || ICON_URL;
      const size = logoUrl ? 32 : 30;

      let marker = markers.get(id);
      if (!marker) {
        const el = document.createElement('div');
        el.style.cssText = `width:${size}px;height:${size}px;pointer-events:auto;cursor:pointer;`;
        const img = document.createElement('img');
        img.src = iconUrl;
        img.style.cssText = `width:${size}px;height:${size}px;`;
        img.draggable = false;
        el.appendChild(img);
        el.addEventListener('click', () => callbackRef.current?.(station));
        marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([position.lng, position.lat])
          .addTo(map);
        markers.set(id, marker);
      } else {
        marker.setLngLat([position.lng, position.lat]);
      }
    });

    for (const [id, marker] of markers) {
      if (!seen.has(id)) { marker.remove(); markers.delete(id); }
    }
  }, [map, validStations, zoom]);

  useEffect(() => {
    if (!map) return;
    const update = () => setZoom(map.getZoom() || 0);
    update();
    map.on('zoom', update);
    return () => map.off('zoom', update);
  }, [map]);

  useEffect(() => () => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
  }, []);

  return null;
}