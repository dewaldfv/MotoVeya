/* global google */
import { useEffect, useRef, useMemo, useState } from 'react';
import { useGoogleMap } from '@react-google-maps/api';
import { getServiceCategory } from '@/lib/serviceCategories';

// Native Google Maps markers are used here deliberately. They are more reliable
// than HTML OverlayView markers for a large, frequently changing POI layer.
const SERVICE_MIN_ZOOM = 13;

export const ENGEN_LOGO = 'data:image/png;base64,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';

export function getEngenMarkerIcon(g) {
  // Wrap the original Engen PNG in a transparent SVG so Google Maps renders
  // the logo reliably at marker size without stretching or replacing it.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><image href="${ENGEN_LOGO}" x="1" y="1" width="46" height="46" preserveAspectRatio="xMidYMid meet"/></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new g.maps.Size(48, 48),
    anchor: new g.maps.Point(24, 24),
  };
}

function markerSvg(service, category) {
  const name = String(service.name || service.brand || '').toLowerCase();
  if (name.includes('engen')) return ENGEN_LOGO;
  if (service.logo_url) return service.logo_url;

  const emoji = category?.emoji || '🏍️';
  const bg = category?.color || '#FF6F00';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <circle cx="28" cy="28" r="25" fill="${bg}" stroke="white" stroke-width="4"/>
    <text x="28" y="36" text-anchor="middle" font-size="25">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function distanceMeters(a, b) {
  const lat1 = Number(a.lat) * Math.PI / 180;
  const lat2 = Number(b.lat) * Math.PI / 180;
  const dLat = lat2 - lat1;
  const dLng = (Number(b.lng) - Number(a.lng)) * Math.PI / 180;
  const x = dLng * Math.cos((lat1 + lat2) / 2);
  const y = dLat;
  return Math.sqrt(x * x + y * y) * 6371000;
}

function spiderfy(services) {
  const groups = [];
  services.forEach((service) => {
    const existing = groups.find((group) => distanceMeters(service, group[0]) <= 60);
    if (existing) existing.push(service);
    else groups.push([service]);
  });

  const result = [];
  groups.forEach((group) => {
    group.forEach((service, index) => {
      let lat = Number(service.lat);
      let lng = Number(service.lng);
      if (group.length > 1) {
        const angle = (index / group.length) * Math.PI * 2 - Math.PI / 2;
        const radius = group.length <= 4 ? 28 : 34;
        lat += Math.sin(angle) * radius / 111320;
        lng += Math.cos(angle) * radius / (111320 * Math.cos(lat * Math.PI / 180));
      }
      result.push({ service, lat, lng });
    });
  });
  return result;
}

export default function ServiceMarkers({ services = [], userPos, onMarkerClick }) {
  const map = useGoogleMap();
  const markersRef = useRef(new Map());
  const callbackRef = useRef(onMarkerClick);
  const [zoom, setZoom] = useState(() => map?.getZoom() || 0);
  callbackRef.current = onMarkerClick;

  const validServices = useMemo(() => services
    .map((service) => ({ ...service, lat: Number(service.lat), lng: Number(service.lng) }))
    .filter((service) =>
      Number.isFinite(service.lat) && Number.isFinite(service.lng) &&
      Math.abs(service.lat) <= 90 && Math.abs(service.lng) <= 180
    ), [services]);

  useEffect(() => {
    if (!map || !window.google?.maps) return;

    const g = window.google;
    const markers = markersRef.current;
    const shouldShow = zoom >= SERVICE_MIN_ZOOM;
    const visible = shouldShow ? spiderfy(validServices) : [];
    const seen = new Set();

    visible.forEach(({ service, lat, lng }) => {
      const id = `service-${service.id}`;
      seen.add(id);
      const category = getServiceCategory(service.category);
      const icon = String(service.name || service.brand || '').toLowerCase().includes('engen')
        ? getEngenMarkerIcon(g)
        : (() => {
            const iconUrl = markerSvg(service, category);
            return {
              url: iconUrl,
              scaledSize: new g.maps.Size(44, 44),
              anchor: new g.maps.Point(22, 22),
            };
          })();

      let marker = markers.get(id);
      if (!marker) {
        marker = new g.maps.Marker({
          map,
          position: { lat, lng },
          icon,
          title: service.name || category.label,
          zIndex: 200,
          optimized: true,
        });
        marker.addListener('click', () => callbackRef.current?.(service));
        markers.set(id, marker);
      } else {
        marker.setMap(map);
        marker.setPosition({ lat, lng });
        marker.setIcon(icon);
        marker.setTitle(service.name || category.label);
      }
    });

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.setMap(null);
        markers.delete(id);
      }
    }
  }, [map, validServices, userPos, zoom]);

  // Keep the marker layer synchronized with the map zoom.
  useEffect(() => {
    if (!map) return;
    const updateZoom = () => setZoom(map.getZoom() || 0);
    updateZoom();
    const listener = map.addListener('zoom_changed', updateZoom);
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

function gmapsRemove(listener) {
  if (window.google?.maps?.event && listener) window.google.maps.event.removeListener(listener);
}
