import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import { useMapInstance } from '@/lib/maplibreContext';

/**
 * Renders arbitrary HTML content at a geographic position on a MapLibre map.
 * Uses maplibregl.Marker which natively supports custom DOM elements — no
 * OverlayView required (unlike the Google Maps raster-only approach).
 *
 * @param {number[]|{lat:number,lng:number}} position - [lat, lng] or {lat, lng}
 * @param {React.ReactNode} children - marker visual content
 * @param {function} onClick - click handler
 * @param {string} anchor - 'center' (default) or 'bottom' (pin-style)
 * @param {number} zIndex - marker z-index
 */
export default function CustomMapMarker({ position, children, onClick, zIndex = 0, anchor = 'center' }) {
  const map = useMapInstance();
  const markerRef = useRef(null);
  const containerRef = useRef(null);
  const rootRef = useRef(null);

  // Create the DOM container once
  if (!containerRef.current && typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.style.cursor = onClick ? 'pointer' : 'default';
    containerRef.current = div;
  }

  useEffect(() => {
    if (!map || !containerRef.current) return;

    const lat = Array.isArray(position) ? position[0] : position?.lat;
    const lng = Array.isArray(position) ? position[1] : position?.lng;
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;

    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({
        element: containerRef.current,
        anchor: anchor === 'bottom' ? 'bottom' : 'center',
      })
        .setLngLat([Number(lng), Number(lat)])
        .addTo(map);

      if (onClick) {
        containerRef.current.addEventListener('click', onClick);
      }
    } else {
      markerRef.current.setLngLat([Number(lng), Number(lat)]);
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, position?.[0] ?? position?.lat, position?.[1] ?? position?.lng, anchor]);

  // Keep click handler fresh
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor = onClick ? 'pointer' : 'default';
    }
  }, [onClick]);

  // Render children into the container using a detached React root
  useEffect(() => {
    if (!containerRef.current) return;
    if (!rootRef.current) {
      rootRef.current = createRoot(containerRef.current);
    }
    rootRef.current.render(
      <div
        style={{
          cursor: onClick ? 'pointer' : 'default',
          display: 'flex',
          alignItems: anchor === 'bottom' ? 'flex-end' : 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </div>
    );
  }, [children, onClick, anchor]);

  // Unmount the React root on component unmount
  useEffect(() => {
    return () => {
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
    };
  }, []);

  return null;
}