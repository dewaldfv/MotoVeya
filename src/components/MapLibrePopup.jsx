import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import { useMapInstance } from '@/lib/maplibreContext';

/**
 * Renders a MapLibre popup with React children as its content.
 * Replaces <InfoWindow> from @react-google-maps/api.
 *
 * @param {{lat:number,lng:number}} position — popup position
 * @param {function} onClose — called when the popup is closed
 * @param {React.ReactNode} children — popup content
 */
export default function MapLibrePopup({ position, onClose, children }) {
  const map = useMapInstance();
  const popupRef = useRef(null);
  const containerRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!map || !position) return;

    if (!containerRef.current) {
      containerRef.current = document.createElement('div');
    }
    if (!rootRef.current) {
      rootRef.current = createRoot(containerRef.current);
    }

    popupRef.current = new maplibregl.Popup({
      offset: 25,
      closeOnClick: false,
      closeButton: true,
      maxWidth: '320px',
    })
      .setLngLat([position.lng, position.lat])
      .setDOMContent(containerRef.current)
      .addTo(map);

    popupRef.current.on('close', () => onClose?.());

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, position?.lat, position?.lng]);

  useEffect(() => {
    if (rootRef.current && containerRef.current) {
      rootRef.current.render(children);
    }
  }, [children]);

  useEffect(() => () => {
    if (rootRef.current) {
      rootRef.current.unmount();
      rootRef.current = null;
    }
  }, []);

  return null;
}