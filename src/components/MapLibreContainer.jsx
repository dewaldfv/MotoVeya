import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getMapStyle, getLayerBackground } from '@/lib/mapLayers';
import { MapProvider } from '@/lib/maplibreContext';

/**
 * MapLibreContainer — creates and manages a MapLibre GL JS map instance,
 * provides it to child components via React context, and handles style
 * switching and resize. Replaces <GoogleMap> from @react-google-maps/api.
 *
 * Children access the map via `useMapInstance()` and re-add GeoJSON
 * sources/layers on style change via `useMapStyleVersion()`.
 */
export default function MapLibreContainer({
  center = [-26.2041, 28.0473],
  zoom = 12,
  layer = 'standard',
  className = '',
  pitch = 0,
  bearing = 0,
  onContextMenu,
  children,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [styleVersion, setStyleVersion] = useState(0);
  const bgColor = getLayerBackground(layer);

  // Capture initial center once (MapLibre uses [lng, lat])
  const initialCenterRef = useRef(null);
  if (!initialCenterRef.current) {
    initialCenterRef.current = [Number(center[1]), Number(center[0])];
  }

  // Create map on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const mapInstance = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(layer),
      center: initialCenterRef.current,
      zoom,
      bearing,
      pitch,
      attributionControl: { compact: true },
      antialias: true,
    });
    mapRef.current = mapInstance;

    // Set map state once the first style is fully loaded so children can
    // safely add sources and layers.
    let firstLoad = true;
    mapInstance.on('load', () => {
      if (firstLoad) {
        firstLoad = false;
        setMap(mapInstance);
      }
    });
    mapInstance.on('style.load', () => {
      setStyleVersion((v) => v + 1);
    });

    // Resize handling
    const ro = new ResizeObserver(() => mapInstance.resize());
    ro.observe(containerRef.current);
    const onOrient = () => setTimeout(() => mapInstance.resize(), 300);
    window.addEventListener('orientationchange', onOrient);

    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', onOrient);
      mapInstance.remove();
      mapRef.current = null;
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle layer/style changes
  useEffect(() => {
    if (!mapRef.current) return;
    const style = getMapStyle(layer);
    // setStyle triggers 'style.load' which increments styleVersion,
    // causing child components to re-add their GeoJSON sources/layers.
    mapRef.current.setStyle(style);
  }, [layer]);

  // Context menu (right-click) — used for long-press destination selection
  useEffect(() => {
    if (!mapRef.current || !onContextMenu) return;
    const handler = (e) => {
      if (e.lngLat) onContextMenu({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    };
    mapRef.current.on('contextmenu', handler);
    return () => {
      mapRef.current?.off('contextmenu', handler);
    };
  }, [map, onContextMenu]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 ${className}`}
      style={{ background: bgColor }}
    >
      {map && (
        <MapProvider value={{ map, styleVersion }}>
          {children}
        </MapProvider>
      )}
    </div>
  );
}