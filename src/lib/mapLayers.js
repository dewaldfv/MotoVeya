import { useState } from 'react';

const STORAGE_KEY = 'motogo_map_layer';

export const MAP_LAYERS = [
  {
    key: 'standard',
    label: 'Standard',
    description: 'Default road map',
    preview: 'linear-gradient(135deg, #eef2f7 0%, #dce8d0 50%, #c9dcc4 100%)',
    tiles: [{ url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors' }],
  },
  {
    key: 'satellite',
    label: 'Satellite',
    description: 'High-resolution imagery',
    preview: 'linear-gradient(135deg, #1f2a14 0%, #3b4a22 45%, #5d6e34 100%)',
    tiles: [{ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri, Maxar, Earthstar Geographics' }],
  },
  {
    key: 'terrain',
    label: 'Terrain',
    description: 'Elevation & hills',
    preview: 'linear-gradient(135deg, #d8c9a0 0%, #a9bc8e 50%, #6e8a5c 100%)',
    tiles: [{ url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenTopoMap (CC-BY-SA)' }],
  },
  {
    key: 'hybrid',
    label: 'Hybrid',
    description: 'Satellite with labels',
    preview: 'linear-gradient(135deg, #1f2a14 0%, #3b4a22 50%, #5d6e34 100%)',
    tiles: [
      { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri, Maxar, Earthstar Geographics' },
      { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', attribution: '' },
      { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', attribution: '' },
    ],
  },
  {
    key: 'dark',
    label: 'Dark Mode',
    description: 'Optimized for night riding',
    preview: 'linear-gradient(135deg, #0a0a0a 0%, #1c1c1c 50%, #2a2a2a 100%)',
    tiles: [{ url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap &copy; CARTO' }],
  },
];

export const DEFAULT_LAYER = 'dark';

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