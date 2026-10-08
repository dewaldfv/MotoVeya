/**
 * Shared utilities for the MapLibre-based map components.
 * MapLibre uses [lng, lat] coordinate order; the app uses [lat, lng].
 */

/** Convert [lat, lng] to MapLibre [lng, lat] */
export function toLngLat(lat, lng) {
  return [lng, lat];
}

/** Convert an array of [lat, lng] pairs to MapLibre [lng, lat] pairs */
export function toLngLatArray(coords) {
  return (coords || []).map(([lat, lng]) => [Number(lng), Number(lat)]);
}

/** Build a GeoJSON LineString feature from [lat, lng] coordinate pairs */
export function lineStringFeature(coords) {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: toLngLatArray(coords),
    },
  };
}

/** Build a GeoJSON Polygon feature approximating a circle */
export function circlePolygon(lat, lng, radiusMeters, steps = 64) {
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radiusMeters / 111320) * Math.sin(angle);
    const dLng = (radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.cos(angle);
    coords.push([Number(lng) + dLng, Number(lat) + dLat]);
  }
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}

/** Create an <img> element from a data-URI or URL */
export function createImgElement(src, size = 44) {
  const img = document.createElement('img');
  img.src = src;
  img.style.width = `${size}px`;
  img.style.height = `${size}px`;
  img.style.pointerEvents = 'none';
  img.draggable = false;
  return img;
}

/** Create a <div> element with inline HTML content */
export function createHtmlElement(html, style = {}) {
  const div = document.createElement('div');
  div.innerHTML = html;
  Object.entries(style).forEach(([k, v]) => { div.style[k] = v; });
  return div;
}

/** Safely remove a source and its dependent layers from a MapLibre map */
export function removeSourceAndLayer(map, sourceId, layerId) {
  if (!map) return;
  try {
    if (layerId && map.getLayer(layerId)) map.removeLayer(layerId);
  } catch { /* layer may not exist after style change */ }
  try {
    if (sourceId && map.getSource(sourceId)) map.removeSource(sourceId);
  } catch { /* source may not exist after style change */ }
}