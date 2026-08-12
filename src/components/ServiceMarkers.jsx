/* global google */
import { useEffect, useRef, useState } from 'react';
import { useGoogleMap } from '@react-google-maps/api';
import { haversine } from '@/lib/serviceCategories';
import { getServiceMarkerUrl, getClusterMarkerUrl } from '@/lib/serviceMarkers';

const SERVICE_ZOOM_THRESHOLD = 13;
const SERVICE_DISTANCE_KM = 10;

function clusterServices(services, zoom) {
  const precision = zoom >= 15 ? 5 : zoom >= 14 ? 4 : 3;
  const groups = {};
  services.forEach((s) => {
    const key = `${s.lat.toFixed(precision)},${s.lng.toFixed(precision)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  return Object.values(groups).map((items) => {
    if (items.length === 1) return { type: 'single', service: items[0] };
    const avgLat = items.reduce((sum, s) => sum + s.lat, 0) / items.length;
    const avgLng = items.reduce((sum, s) => sum + s.lng, 0) / items.length;
    return { type: 'cluster', count: items.length, lat: avgLat, lng: avgLng };
  });
}

/**
 * ServiceMarkers — renders service pins as native google.maps.Marker instances with
 * per-category custom image icons (matching the NativeEventMarkers approach), so
 * services share the same custom-marker styling as events. Zoom-gated to >= 13 and
 * distance-filtered to the rider; co-located services collapse into a count cluster.
 */
export default function ServiceMarkers({ services, userPos, onMarkerClick }) {
  const map = useGoogleMap();
  const [zoom, setZoom] = useState(map?.getZoom() || 13);
  const markersRef = useRef(new Map());
  const cbRef = useRef(onMarkerClick);
  cbRef.current = onMarkerClick;

  useEffect(() => {
    if (!map) return;
    setZoom(map.getZoom());
    const onZoom = () => setZoom(map.getZoom());
    const id = map.addListener('zoom_changed', onZoom);
    return () => google.maps.event.removeListener(id);
  }, [map]);

  useEffect(() => {
    if (!map || !window.google) return;
    const g = window.google;
    const markers = markersRef.current;
    markers.forEach((m) => m.setMap(null));
    markers.clear();

    if (zoom < SERVICE_ZOOM_THRESHOLD) return;

    const filtered = userPos
      ? services.filter((s) => haversine(userPos[0], userPos[1], s.lat, s.lng) <= SERVICE_DISTANCE_KM)
      : services;

    clusterServices(filtered, zoom).forEach((item) => {
      if (item.type === 'single') {
        const s = item.service;
        if (s.lat == null || s.lng == null || isNaN(s.lat) || isNaN(s.lng)) return;
        const icon = {
          url: getServiceMarkerUrl(s.category),
          scaledSize: new g.maps.Size(44, 44),
          anchor: new g.maps.Point(22, 22),
        };
        const m = new g.maps.Marker({ position: new g.maps.LatLng(s.lat, s.lng), map, icon, zIndex: 400 });
        m.addListener('click', () => cbRef.current?.(s));
        markers.set(`svc-${s.id}`, m);
      } else {
        const icon = {
          url: getClusterMarkerUrl(item.count),
          scaledSize: new g.maps.Size(44, 44),
          anchor: new g.maps.Point(22, 22),
        };
        const m = new g.maps.Marker({ position: new g.maps.LatLng(item.lat, item.lng), map, icon, zIndex: 400 });
        markers.set(`svc-cluster-${item.lat}-${item.lng}`, m);
      }
    });
  }, [map, services, userPos, zoom]);

  useEffect(() => () => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current.clear();
  }, []);

  return null;
}