/* global google */
import { useEffect, useRef, useMemo } from 'react';
import { useGoogleMap } from '@react-google-maps/api';
import { getServiceCategory } from '@/lib/serviceCategories';

// Native Google Maps markers are used here deliberately. They are more reliable
// than HTML OverlayView markers for a large, frequently changing POI layer.
const SERVICE_MIN_ZOOM = 11;

function markerSvg(service, category) {
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
    const zoom = map.getZoom() || 0;
    const shouldShow = zoom >= SERVICE_MIN_ZOOM;
    const visible = shouldShow ? spiderfy(validServices) : [];
    const seen = new Set();

    visible.forEach(({ service, lat, lng }) => {
      const id = `service-${service.id}`;
      seen.add(id);
      const category = getServiceCategory(service.category);
      const iconUrl = markerSvg(service, category);
      const icon = {
        url: iconUrl,
        scaledSize: new g.maps.Size(44, 44),
        anchor: new g.maps.Point(22, 22),
      };

      let marker = markers.get(id);
      if (!marker) {
        marker = new g.maps.Marker({
          map,
          position: { lat, lng },
          icon,
          title: service.name || category.label,
          zIndex: 600,
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
  }, [map, validServices, userPos]);

  useEffect(() => {
    if (!map) return;
    const refresh = () => {
      const event = new Event('service-marker-refresh');
      window.dispatchEvent(event);
    };
    const listener = map.addListener('zoom_changed', refresh);
    return () => gmapsRemove(listener);
  }, [map]);

  // Re-run marker visibility whenever the map zoom changes.
  useEffect(() => {
    if (!map) return;
    const markers = markersRef.current;
    const updateVisibility = () => {
      const visible = (map.getZoom() || 0) >= SERVICE_MIN_ZOOM;
      markers.forEach((marker) => marker.setMap(visible ? map : null));
    };
    const listener = map.addListener('zoom_changed', updateVisibility);
    updateVisibility();
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
