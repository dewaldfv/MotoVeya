import { useEffect } from 'react';
import { useMapInstance, useMapStyleVersion } from '@/lib/maplibreContext';
import { circlePolygon, removeSourceAndLayer } from '@/lib/maplibreUtils';

/**
 * Renders a circle on a MapLibre map via a GeoJSON polygon source + fill layer.
 * Replaces <Circle> from @react-google-maps/api.
 *
 * @param {string} id — unique source/layer prefix
 * @param {number[]} center — [lat, lng]
 * @param {number} radius — radius in meters
 * @param {string} strokeColor
 * @param {number} strokeOpacity
 * @param {number} strokeWeight
 * @param {string} fillColor
 * @param {number} fillOpacity
 */
export default function MapLibreCircle({
  id,
  center,
  radius = 1000,
  strokeColor = '#FF6F00',
  strokeOpacity = 0.85,
  strokeWeight = 2,
  fillColor,
  fillOpacity = 0.1,
}) {
  const map = useMapInstance();
  const styleVersion = useMapStyleVersion();
  const sourceId = `circle-src-${id}`;
  const layerId = `circle-layer-${id}`;

  useEffect(() => {
    if (!map) return;
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] } },
      });
    }
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': fillColor || strokeColor,
          'fill-opacity': fillOpacity,
        },
      });
      map.addLayer({
        id: `${layerId}-outline`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': strokeColor,
          'line-opacity': strokeOpacity,
          'line-width': strokeWeight,
        },
      });
    }
    return () => {
      removeSourceAndLayer(map, sourceId, layerId);
      removeSourceAndLayer(map, null, `${layerId}-outline`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleVersion, sourceId, layerId]);

  useEffect(() => {
    if (!map || !center) return;
    const src = map.getSource(sourceId);
    if (src) src.setData(circlePolygon(center[0], center[1], radius));
  }, [map, center, radius, sourceId]);

  return null;
}