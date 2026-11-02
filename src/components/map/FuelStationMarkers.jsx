import { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapInstance } from '@/lib/maplibreContext';
import { resolveFuelBrand } from '@/lib/fuelBrandLogos';

const FUEL_MIN_ZOOM = 12;
const CHIP_STYLE = 'width:36px;height:36px;border-radius:11px;background:#0b0b0b;border:2px solid rgba(255,255,255,0.92);box-shadow:0 3px 10px rgba(0,0,0,0.5);overflow:hidden;display:flex;align-items:center;justify-content:center;';
const PLAIN_STYLE = 'width:36px;height:36px;display:flex;align-items:center;justify-content:center;';
const CHIP_IMAGE_STYLE = 'width:100%;height:100%;object-fit:contain;display:block;';
const PLAIN_IMAGE_STYLE = 'width:36px;height:36px;display:block;';

function genericMarkerUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
    <circle cx="28" cy="28" r="25" fill="#22c55e" stroke="white" stroke-width="4"/>
    <text x="28" y="37" text-anchor="middle" font-size="26">&#9981;</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/**
 * Renders fuel stations from OpenStreetMap as MapLibre markers. Stations whose
 * brand tag, operator or name matches one of the supplied brand logos show that
 * logo; every other station keeps the generic fuel marker.
 */
export default function FuelStationMarkers({ stations = [], onMarkerClick }) {
  const map = useMapInstance();
  const markersRef = useRef(new Map());
  const callbackRef = useRef(onMarkerClick);
  const [zoom, setZoom] = useState(() => map?.getZoom() || 0);
  const genericUrl = useMemo(genericMarkerUrl, []);
  callbackRef.current = onMarkerClick;

  const validStations = useMemo(() => stations
    .map((station) => ({ ...station, lat: Number(station.lat), lng: Number(station.lng) }))
    .filter((station) =>
      Number.isFinite(station.lat) && Number.isFinite(station.lng) &&
      Math.abs(station.lat) <= 90 && Math.abs(station.lng) <= 180
    ), [stations]);

  useEffect(() => {
    if (!map) return;
    const markers = markersRef.current;
    const visible = zoom >= FUEL_MIN_ZOOM ? validStations : [];
    const seen = new Set();

    visible.forEach((station) => {
      const id = `fuel-${station.id || `${station.lat},${station.lng}`}`;
      seen.add(id);
      const brand = resolveFuelBrand(station);
      const logoUrl = brand?.url || null;

      const existing = markers.get(id);
      if (existing) {
        existing.marker.setLngLat([station.lng, station.lat]);
        // Brand data can arrive after a marker was created; refresh the artwork.
        if (existing.logoUrl !== logoUrl) {
          existing.logoUrl = logoUrl;
          existing.img.src = logoUrl || genericUrl;
          existing.chip.style.cssText = logoUrl ? CHIP_STYLE : PLAIN_STYLE;
          existing.img.style.cssText = logoUrl ? CHIP_IMAGE_STYLE : PLAIN_IMAGE_STYLE;
        }
        return;
      }

      const el = document.createElement('div');
      el.style.cssText = 'width:36px;height:36px;pointer-events:auto;cursor:pointer;';
      el.title = station.name || brand?.label || 'Fuel Station';

      const chip = document.createElement('div');
      chip.style.cssText = logoUrl ? CHIP_STYLE : PLAIN_STYLE;

      const img = document.createElement('img');
      img.src = logoUrl || genericUrl;
      img.draggable = false;
      img.style.cssText = logoUrl ? CHIP_IMAGE_STYLE : PLAIN_IMAGE_STYLE;

      chip.appendChild(img);
      el.appendChild(chip);
      el.addEventListener('click', () => callbackRef.current?.(station));
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([station.lng, station.lat])
        .addTo(map);
      markers.set(id, { marker, img, chip, logoUrl });
    });

    for (const [id, entry] of markers) {
      if (!seen.has(id)) { entry.marker.remove(); markers.delete(id); }
    }
  }, [map, validStations, zoom, genericUrl]);

  useEffect(() => {
    if (!map) return;
    const updateZoom = () => setZoom(map.getZoom() || 0);
    updateZoom();
    map.on('zoom', updateZoom);
    return () => map.off('zoom', updateZoom);
  }, [map]);

  useEffect(() => () => {
    markersRef.current.forEach((entry) => entry.marker.remove());
    markersRef.current.clear();
  }, []);

  return null;
}