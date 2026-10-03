/* global google */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGoogleMap } from '@react-google-maps/api';

const MIN_ZOOM = 13;

function buildFuelMarkerSvg() {
  // MotoVeya fuel-station marker: orange rounded-square outline with the
  // supplied petrol-pump symbol. The checkerboard in the source image is
  // transparency, so it is intentionally not included.
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

const ICON_URL = buildFuelMarkerSvg();

function validStation(station) {
  const lat = Number(station.lat);
  const lng = Number(station.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export default function FuelStationMarkers({ stations = [], onMarkerClick }) {
  const map = useGoogleMap();
  const markersRef = useRef(new Map());
  const callbackRef = useRef(onMarkerClick);
  const [zoom, setZoom] = useState(() => map?.getZoom() || 0);
  callbackRef.current = onMarkerClick;

  const validStations = useMemo(() => stations.filter(validStation), [stations]);

  useEffect(() => {
    if (!map || !window.google?.maps) return;
    const g = window.google;
    const markers = markersRef.current;
    const visible = zoom > 12 ? validStations : [];
    const seen = new Set();

    visible.forEach((station) => {
      const id = station.id || `fuel-${station.lat}-${station.lng}`;
      seen.add(id);
      const position = { lat: Number(station.lat), lng: Number(station.lng) };
      let marker = markers.get(id);

      const logoUrl = station.logo_url || station.marker_logo_url;
      const markerIcon = logoUrl
        ? {
            url: logoUrl,
            scaledSize: new g.maps.Size(32, 32),
            anchor: new g.maps.Point(16, 16),
          }
        : {
            url: ICON_URL,
            scaledSize: new g.maps.Size(30, 30),
            anchor: new g.maps.Point(15, 15),
          };

      if (!marker) {
        marker = new g.maps.Marker({
          map,
          position,
          icon: markerIcon,
          title: station.brand ? `${station.brand} — ${station.name || 'Fuel Station'}` : (station.name || 'Fuel Station'),
          zIndex: 300,
          optimized: true,
        });
        marker.addListener('click', () => callbackRef.current?.(station));
        markers.set(id, marker);
      } else {
        marker.setMap(map);
        marker.setPosition(position);
        marker.setIcon(markerIcon);
        marker.setTitle(station.brand ? `${station.brand} — ${station.name || 'Fuel Station'}` : (station.name || 'Fuel Station'));
      }
    });

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.setMap(null);
        markers.delete(id);
      }
    }
  }, [map, validStations, zoom]);

  useEffect(() => {
    if (!map) return;
    const update = () => setZoom(map.getZoom() || 0);
    update();
    const listener = map.addListener('zoom_changed', update);
    return () => {
      if (window.google?.maps?.event) window.google.maps.event.removeListener(listener);
    };
  }, [map]);

  useEffect(() => () => {
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();
  }, []);

  return null;
}
