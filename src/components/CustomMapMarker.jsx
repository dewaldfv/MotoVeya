/* global google */
import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useGoogleMap } from '@react-google-maps/api';

/**
 * Renders arbitrary HTML content at a geographic position on a GoogleMap.
 * Uses the modern AdvancedMarkerElement API, which is synced to the map's
 * vector canvas rendering loop. This eliminates the panning jitter/flicker
 * that the legacy OverlayView (floatPane) approach exhibited.
 * @param {number[]|{lat:number,lng:number}} position - [lat, lng] or {lat, lng}
 * @param {React.ReactNode} children - marker visual content
 * @param {function} onClick - click handler
 * @param {string} anchor - 'center' (default) or 'bottom' (pin-style)
 */
export default function CustomMapMarker({ position, children, onClick, zIndex = 0, anchor = 'center' }) {
  const map = useGoogleMap();
  const markerRef = useRef(null);
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  // Build the DOM container once. We render React children into it via a
  // stable wrapper div so the AdvancedMarkerElement content is directly
  // managed by the map's renderer.
  if (!containerRef.current && typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.style.cursor = onClick ? 'pointer' : 'default';
    div.style.transform = anchor === 'bottom' ? 'translateY(-50%)' : 'none';
    containerRef.current = div;
  }

  useEffect(() => {
    if (!map || !window.google?.maps?.marker?.AdvancedMarkerElement || !containerRef.current) return;

    const lat = Array.isArray(position) ? position[0] : position?.lat;
    const lng = Array.isArray(position) ? position[1] : position?.lng;
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;

    const latLng = { lat, lng };

    if (!markerRef.current) {
      markerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: latLng,
        content: containerRef.current,
        zIndex,
      });
      if (onClick) {
        google.maps.event.addListener(markerRef.current, 'click', () => onClick());
      }
    } else {
      markerRef.current.position = latLng;
      markerRef.current.zIndex = zIndex;
    }

    return () => {
      if (markerRef.current) {
        google.maps.event.clearInstanceListeners(markerRef.current);
        markerRef.current.map = null;
        markerRef.current = null;
      }
    };
  }, [map, position, zIndex]);

  // Keep click handler fresh without recreating the marker.
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor = onClick ? 'pointer' : 'default';
    }
  }, [onClick]);

  // Render children into the container using a detached React root.
  // The root is created once and reused; we only re-render when content changes.
  useEffect(() => {
    if (!containerRef.current) return;
    if (!contentRef.current) {
      contentRef.current = createRoot(containerRef.current);
    }
    contentRef.current.render(
      <div
        onClick={onClick}
        style={{
          cursor: onClick ? 'pointer' : 'default',
          display: 'flex',
          alignItems: anchor === 'bottom' ? 'flex-end' : 'center',
          justifyContent: 'center',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    );
  }, [children, onClick, anchor]);

  // Unmount the React root on component unmount.
  useEffect(() => {
    return () => {
      if (contentRef.current) {
        contentRef.current.unmount();
        contentRef.current = null;
      }
    };
  }, []);

  return null;
}