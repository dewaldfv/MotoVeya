import { useState } from 'react';

const STORAGE_KEY = 'motogo_map_layer';

const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a0a0a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6b6b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#151515' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1520' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3a5a7a' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0f0f0f' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#5a5a5a' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
];

export const MAP_LAYERS = [
  {
    key: 'standard',
    label: 'Default',
    description: 'Clean road map',
    preview: 'linear-gradient(135deg, #f4f6f9 0%, #e6edf3 45%, #dce4ec 100%)',
    mapTypeId: 'roadmap',
    styles: null,
  },
  {
    key: 'satellite',
    label: 'Satellite',
    description: 'Aerial imagery',
    preview: 'linear-gradient(135deg, #1f2a14 0%, #3b4a22 45%, #5d6e34 100%)',
    mapTypeId: 'satellite',
    styles: null,
  },
  {
    key: 'terrain',
    label: 'Terrain',
    description: 'Elevation & hills',
    preview: 'linear-gradient(135deg, #d8c9a0 0%, #a9bc8e 50%, #6e8a5c 100%)',
    mapTypeId: 'terrain',
    styles: null,
  },
  {
    key: 'hybrid',
    label: 'Hybrid',
    description: 'Satellite with labels',
    preview: 'linear-gradient(135deg, #1f2a14 0%, #3b4a22 50%, #5d6e34 100%)',
    mapTypeId: 'hybrid',
    styles: null,
  },
  {
    key: 'dark',
    label: 'Dark',
    description: 'Night riding',
    preview: 'linear-gradient(135deg, #0a0a0a 0%, #1c1c1c 50%, #2a2a2a 100%)',
    mapTypeId: 'roadmap',
    styles: DARK_STYLE,
  },
];

export const DEFAULT_LAYER = 'dark';

const LAYER_BG = {
  standard: '#e8eaed',
  satellite: '#1a1a1a',
  terrain: '#d8c9a0',
  hybrid: '#1a1a1a',
  dark: '#0a0a0a',
};

export function getLayerBackground(key) {
  return LAYER_BG[key] || '#e8eaed';
}

export function getLayerStyles(layer) {
  const config = MAP_LAYERS.find((l) => l.key === layer) || MAP_LAYERS[0];
  const poiHide = [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  ];
  return config.styles ? [...poiHide, ...config.styles] : poiHide;
}

export function getMapOptions(layer) {
  const config = MAP_LAYERS.find((l) => l.key === layer) || MAP_LAYERS[0];
  return {
    mapId: 'motogo_main_map',
    mapTypeId: config.mapTypeId,
    styles: getLayerStyles(layer),
    zoomControl: false,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    clickableIcons: false,
  };
}

export function useMapLayer() {
  const [layer, setLayerState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_LAYER;
    } catch {
      return DEFAULT_LAYER;
    }
  });
  const setLayer = (next) => {
    setLayerState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  };
  return [layer, setLayer];
}