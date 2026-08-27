/* global google */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGoogleMap } from '@react-google-maps/api';

const MIN_ZOOM = 13;

function buildFuelMarkerSvg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="62" viewBox="0 0 52 62">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="180%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.35"/>
      </filter>
    </defs>
    <path d="M26 2C12.75 2 2 12.75 2 26c0 16.4 18.8 30.8 23 33.7.58.4 1.42.4 2 0C31.2 56.8 50 42.4 50 26 50 12.75 39.25 2 26 2Z" fill="#111827" stroke="#ffffff" stroke-width="3" filter="url(#shadow)"/>
    <circle cx="26" cy="25" r="17" fill="#FF6F00"/>
    <path d="M20 16h9c1.1 0 2 .9 2 2v14h2v-8.2l3.1 2.1c.56.38.9 1.01.9 1.69V36h-2v-7.3l-2-1.35V35c0 1.1-.9 2-2 2h-2v-2h2V18h-7v19h-2V16Zm3 4h5v6h-5v-6Z" fill="#fff"/>
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

      if (!marker) {
        marker = new g.maps.Marker({
          map,
          position,
          icon: {
            url: ICON_URL,
            scaledSize: new g.maps.Size(42, 50),
            anchor: new g.maps.Point(21, 50),
          },
          title: station.name || 'Fuel Station',
          zIndex: 300,
          optimized: true,
        });
        marker.addListener('click', () => callbackRef.current?.(station));
        markers.set(id, marker);
      } else {
        marker.setMap(map);
        marker.setPosition(position);
        marker.setTitle(station.name || 'Fuel Station');
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
