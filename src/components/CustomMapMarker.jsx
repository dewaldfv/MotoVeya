/* global google */
import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useGoogleMap } from '@react-google-maps/api';

/**
 * Renders arbitrary HTML content at a geographic position on a GoogleMap.
 * Uses the legacy OverlayView (floatPane) API so the map can be a raster map
 * (no mapId), which is required for the `styles` option to apply our dark
 * theme. Native markers (LiveMarkers, NativeEventMarkers) already use
 * google.maps.Marker and are unaffected.
 * @param {number[]|{lat:number,lng:number}} position - [lat, lng] or {lat, lng}
 * @param {React.ReactNode} children - marker visual content
 * @param {function} onClick - click handler
 * @param {string} anchor - 'center' (default) or 'bottom' (pin-style)
 */
export default function CustomMapMarker({ position, children, onClick, zIndex = 0, anchor = 'center', pane = 'floatPane' }) {
  const map = useGoogleMap();
  const overlayRef = useRef(null);
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const posRef = useRef(null);

  // Build the DOM container once.
  if (!containerRef.current && typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.cursor = onClick ? 'pointer' : 'default';
    containerRef.current = div;
  }

  useEffect(() => {
    if (!map || !window.google?.maps?.OverlayView || !containerRef.current) return;

    const lat = Array.isArray(position) ? position[0] : position?.lat;
    const lng = Array.isArray(position) ? position[1] : position?.lng;
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;
    posRef.current = { lat, lng };

    class HTMLOverlay extends google.maps.OverlayView {
      constructor() {
        super();
        this._el = containerRef.current;
      }
      onAdd() {
        const targetPane = this.getPanes()[pane] || this.getPanes().floatPane;
        targetPane.appendChild(this._el);
      }
      onRemove() {
        if (this._el.parentNode) this._el.parentNode.removeChild(this._el);
      }
      draw() {
        if (!posRef.current) return;
        const proj = this.getProjection();
        const point = proj.fromLatLngToDivPixel(new google.maps.LatLng(posRef.current.lat, posRef.current.lng));
        if (!point) return;
        const el = this._el;
        el.style.zIndex = String(zIndex);
        if (anchor === 'bottom') {
          el.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -100%)`;
        } else {
          el.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
        }
      }
    }

    if (!overlayRef.current) {
      overlayRef.current = new HTMLOverlay();
      overlayRef.current.setMap(map);
      if (onClick) {
        containerRef.current.addEventListener('click', onClick);
      }
    } else {
      // Trigger redraw with new position.
      overlayRef.current.draw();
    }

    return () => {
      if (overlayRef.current) {
        overlayRef.current.setMap(null);
        overlayRef.current = null;
      }
    };
  }, [map, position, zIndex, anchor, pane]);

  // Keep click handler fresh.
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor = onClick ? 'pointer' : 'default';
    }
  }, [onClick]);

  // Render children into the container using a detached React root.
  useEffect(() => {
    if (!containerRef.current) return;
    if (!contentRef.current) {
      contentRef.current = createRoot(containerRef.current);
    }
    contentRef.current.render(
      <div
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