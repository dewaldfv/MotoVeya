import { useEffect, useRef, useMemo, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapInstance } from '@/lib/maplibreContext';
import { getServiceCategory } from '@/lib/serviceCategories';
const SERVICE_MIN_ZOOM = 13;

function markerSvgUrl(service, category) {
  const name = String(service.name || service.brand || '').toLowerCase();
  if (name.includes('engen') && service.logo_url) return service.logo_url;
  if (service.logo_url) return service.logo_url;

  const emoji = category?.emoji || '\ud83c\udfcd\ufe0f';
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
  const map = useMapInstance();
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
    if (!map) return;
    const markers = markersRef.current;
    const shouldShow = zoom >= SERVICE_MIN_ZOOM;
    const visible = shouldShow ? spiderfy(validServices) : [];
    const seen = new Set();

    visible.forEach(({ service, lat, lng }) => {
      const id = `service-${service.id}`;
      seen.add(id);
      const category = getServiceCategory(service.category);
      const iconUrl = markerSvgUrl(service, category);

      let marker = markers.get(id);
      if (!marker) {
        const el = document.createElement('div');
        el.style.cssText = 'width:44px;height:44px;pointer-events:auto;cursor:pointer;';
        const img = document.createElement('img');
        img.src = iconUrl;
        img.style.cssText = 'width:44px;height:44px;';
        img.draggable = false;
        el.appendChild(img);
        el.addEventListener('click', () => callbackRef.current?.(service));
        marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map);
        markers.set(id, marker);
      } else {
        marker.setLngLat([lng, lat]);
      }
    });

    for (const [id, marker] of markers) {
      if (!seen.has(id)) { marker.remove(); markers.delete(id); }
    }
  }, [map, validServices, userPos, zoom]);

  useEffect(() => {
    if (!map) return;
    const updateZoom = () => setZoom(map.getZoom() || 0);
    updateZoom();
    map.on('zoom', updateZoom);
    return () => map.off('zoom', updateZoom);
  }, [map]);

  useEffect(() => () => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
  }, []);

  return null;
}