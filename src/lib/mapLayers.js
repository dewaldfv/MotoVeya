import { useState, useEffect } from 'react';

const STORAGE_KEY = 'motogo_map_layer';
const THEME_KEY = 'motogo-theme';

// Dark map style built from the app's dark-mode CSS tokens so the map feels
// like part of the app:
//   --background (4%)  -> #0a0a0a   land/geometry
//   --card (10%)       -> #1a1a1a   arterial roads
//   --secondary (14%)  -> #242424   road outlines / highway casing
//   --border (18%)     -> #2e2e2e   local road casing
//   --primary (26 100% 50%) -> #FF6F00  highway accent + labels
//   --muted-foreground -> #a3a3a3  label fill
const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a0a0a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a3a3a3' }] },

  // Primary roads (highways) — orange accent tying into the brand primary
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d2812' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#242424' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#FF6F00' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4a3216' }] },

  // Secondary roads (arterials) — card-level gray
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1f1f1f' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#b5b5b5' }] },

  // Tertiary / local roads — deepest gray
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#141414' }] },
  { featureType: 'road.local', elementType: 'geometry.stroke', stylers: [{ color: '#2e2e2e' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#7a7a7a' }] },

  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1520' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3a5a7a' }] },

  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0f0f0f' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#121212' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f1a0f' }] },

  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#5a5a5a' }] },

  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },

  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#c0c0c0' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#9a9a9a' }] },
];

export const MAP_LAYERS = [
  {
    key: 'auto',
    label: 'Auto',
    description: 'Follow app theme',
    preview: 'linear-gradient(135deg, #0a0a0a 0%, #1f1f1f 45%, #FF6F00 100%)',
    mapTypeId: 'roadmap',
    styles: null,
    auto: true,
  },
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
    preview: 'linear-gradient(135deg, #0a0a0a 0%, #1c1c1c 50%, #3d2812 100%)',
    mapTypeId: 'roadmap',
    styles: DARK_STYLE,
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

export function getLayerStyles(layer) {
  const resolved = resolveLayer(layer);
  const config = MAP_LAYERS.find((l) => l.key === resolved) || MAP_LAYERS[0];
  const poiHide = [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  ];
  return config.styles ? [...poiHide, ...config.styles] : poiHide;
}

export function getMapOptions(layer) {
  const resolved = resolveLayer(layer);
  const config = MAP_LAYERS.find((l) => l.key === resolved) || MAP_LAYERS[0];
  return {
    mapTypeId: config.mapTypeId,
    styles: getLayerStyles(resolved),
    zoomControl: false,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    clickableIcons: false,
  };
}

export function useMapLayer() {
  const [rawLayer, setRawLayer] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_LAYER;
    } catch {
      return DEFAULT_LAYER;
    }
  });
  const [isDark, setIsDark] = useState(() => isAppDark());

  // Re-resolve "auto" whenever the app theme flips (same-tab toggle or system change)
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
  // [resolvedLayerForMap, setLayer, rawLayerForPicker]
  return [resolved, setLayer, rawLayer];
}