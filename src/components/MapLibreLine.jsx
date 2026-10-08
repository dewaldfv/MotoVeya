import { useEffect } from 'react';
import { useMapInstance, useMapStyleVersion } from '@/lib/maplibreContext';
import { lineStringFeature, removeSourceAndLayer } from '@/lib/maplibreUtils';

/**
 * Renders a polyline on a MapLibre map via a GeoJSON source + line layer.
 * Replaces <Polyline> from @react-google-maps/api.
 *
 * @param {string} id — unique source/layer prefix
 * @param {number[][]} coordinates — array of [lat, lng] pairs
 * @param {string} color — stroke color
 * @param {number} width — stroke width in px
 * @param {number} opacity — stroke opacity 0-1
 */
export default function MapLibreLine({
  id,
  coordinates = [],
  color = '#FF6F00',
  width = 5,
  opacity = 1,
  dasharray = null,
}) {
  const map = useMapInstance();
  const styleVersion = useMapStyleVersion();
  const sourceId = `line-src-${id}`;
  const layerId = `line-layer-${id}`;

  // Create / destroy source and layer (runs on mount, style change, unmount)
  useEffect(() => {
    if (!map) return;
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
      });
    }
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {},
        paint: {
          'line-color': color,
          'line-width': width,
          'line-opacity': opacity,
          ...(dasharray ? { 'line-dasharray': dasharray } : {}),
        },
      });
    }
    return () => removeSourceAndLayer(map, sourceId, layerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleVersion, sourceId, layerId]);

  // Update data when coordinates change
  useEffect(() => {
    if (!map || !coordinates || coordinates.length < 2) return;
    const src = map.getSource(sourceId);
    if (src) src.setData(lineStringFeature(coordinates));
  }, [map, coordinates, sourceId]);

  // Update paint properties
  useEffect(() => {
    if (!map || !map.getLayer(layerId)) return;
    map.setPaintProperty(layerId, 'line-color', color);
    map.setPaintProperty(layerId, 'line-width', width);
    map.setPaintProperty(layerId, 'line-opacity', opacity);
    if (dasharray) map.setPaintProperty(layerId, 'line-dasharray', dasharray);
  }, [map, styleVersion, layerId, color, width, opacity, dasharray]);

  return null;
}