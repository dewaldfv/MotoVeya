import { useState, useEffect } from 'react';

/**
 * Map layer configuration for MapLibre GL JS using OpenFreeMap's public
 * vector tile service and ESRI/OpenTopoMap raster tiles for satellite/terrain.
 *
 * OpenFreeMap provides free OSM-derived vector tiles with no API key required.
 * Attribution to OpenStreetMap and OpenFreeMap is handled automatically by
 * MapLibre's attribution control from the style metadata.
 */

const OPENFREEMAP_BASE = 'https://tiles.openfreemap.org/styles';
const STORAGE_KEY = 'motogo_map_layer';
const THEME_KEY = 'motogo-theme';

// --- Raster styles for satellite, terrain, and hybrid ---

const SATELLITE_STYLE = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Imagery \u00a9 Esri',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
};

const TERRAIN_STYLE = {
  version: 8,
  sources: {
    terrain: {
      type: 'raster',
      tiles: [
        'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '\u00a9 OpenTopoMap (CC-BY-SA) \u00b7 \u00a9 OpenStreetMap contributors',
      maxzoom: 17,
    },
  },
  layers: [{ id: 'terrain', type: 'raster', source: 'terrain' }],
};

const HYBRID_STYLE = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
    },
    reference: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    { id: 'satellite', type: 'raster', source: 'satellite' },
    { id: 'reference', type: 'raster', source: 'reference' },
  ],
};

// --- Layer definitions (preserves the same key/label/preview interface) ---

export const MAP_LAYERS = [
  {
    key: 'auto',
    label: 'Auto',
    description: 'Follow app theme',
    preview: 'linear-gradient(135deg, #0a0a0a 0%, #1f1f1f 45%, #FF6F00 100%)',
    auto: true,
  },
  {
    key: 'standard',
    label: 'Default',
    description: 'Clean road map',
    preview: 'linear-gradient(135deg, #f4f6f9 0%, #e6edf3 45%, #dce4ec 100%)',
    styleUrl: `${OPENFREEMAP_BASE}/liberty`,
  },
  {
    key: 'satellite',
    label: 'Satellite',
    description: 'Aerial imagery',
    preview: 'linear-gradient(135deg, #1f2a14 0%, #3b4a22 45%, #5d6e34 100%)',
    style: SATELLITE_STYLE,
  },
  {
    key: 'terrain',
    label: 'Terrain',
    description: 'Elevation & hills',
    preview: 'linear-gradient(135deg, #d8c9a0 0%, #a9bc8e 50%, #6e8a5c 100%)',
    style: TERRAIN_STYLE,
  },
  {
    key: 'hybrid',
    label: 'Hybrid',
    description: 'Satellite with labels',
    preview: 'linear-gradient(135deg, #1f2a14 0%, #3b4a22 50%, #5d6e34 100%)',
    style: HYBRID_STYLE,
  },
  {
    key: 'dark',
    label: 'Dark',
    description: 'Night riding',
    preview: 'linear-gradient(135deg, #0a0a0a 0%, #1c1c1c 50%, #3d2812 100%)',
    styleUrl: `${OPENFREEMAP_BASE}/dark`,
  },
];

export const DEFAULT_LAYER = 'auto';

const LAYER_BG = {
  auto: '#0a0a0a',
  standard: '#e8eaed',
  satellite: '#1a1a1a',
  terrain: '#d8c9a0',
  hybrid: '#1a1a1a',
  dark: '#0a0a0a',
};

function getSystemDark() {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

function isAppDark() {
  if (typeof document !== 'undefined') {
    return document.documentElement.classList.contains('dark');
  }
  try {
    const t = localStorage.getItem(THEME_KEY) || 'auto';
    return t === 'dark' || (t === 'auto' && getSystemDark());
  } catch {
    return false;
  }
}

export function resolveLayer(layer) {
  if (layer !== 'auto') return layer;
  return isAppDark() ? 'dark' : 'standard';
}

export function getLayerBackground(key) {
  const resolved = resolveLayer(key);
  return LAYER_BG[resolved] || '#e8eaed';
}

/** Returns the MapLibre style URL or style object for a given layer key */
export function getMapStyle(layer) {
  const resolved = resolveLayer(layer);
  const config = MAP_LAYERS.find((l) => l.key === resolved) || MAP_LAYERS[1];
  return config.styleUrl || config.style;
}

/**
 * Hook that manages the persisted map layer preference and resolves 'auto'
 * based on the current app theme (dark/light).
 *
 * Returns [resolvedLayer, setLayer, rawLayer] — same interface as before.
 */
export function useMapLayer() {
  const [rawLayer, setRawLayer] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_LAYER;
    } catch {
      return DEFAULT_LAYER;
    }
  });
  const [isDark, setIsDark] = useState(() => isAppDark());

  useEffect(() => {
    const check = () => setIsDark(isAppDark());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', check);
    const onStorage = (e) => { if (e.key === THEME_KEY) check(); };
    window.addEventListener('storage', onStorage);
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      mq.removeEventListener('change', check);
      window.removeEventListener('storage', onStorage);
      observer.disconnect();
    };
  }, []);

  const resolved = rawLayer === 'auto' ? (isDark ? 'dark' : 'standard') : rawLayer;
  const setLayer = (next) => {
    setRawLayer(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  };
  return [resolved, setLayer, rawLayer];
}