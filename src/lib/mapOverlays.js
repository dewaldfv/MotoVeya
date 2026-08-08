import { useState } from 'react';

const STORAGE_KEY = 'motogo_map_overlays';

export const MAP_OVERLAYS = [
  { key: 'events', label: 'Motorcycle Events', emoji: '🏁', default: true },
  { key: 'services', label: 'Motorcycle Services', emoji: '🔧', default: true },
  { key: 'fuel', label: 'Fuel Stations', emoji: '⛽', default: true },
  { key: 'food', label: 'Restaurants & Cafés', emoji: '🍔', default: true },
  { key: 'distress', label: 'Rider in Distress', emoji: '🚨', default: true, premium: true },
  { key: 'friends', label: 'Friends & Groups', emoji: '👥', default: false },
  { key: 'saved', label: 'Saved Locations', emoji: '📍', default: false },
];

const DEFAULTS = MAP_OVERLAYS.reduce((acc, o) => { acc[o.key] = o.default; return acc; }, {});

export function loadOverlays() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
  } catch {}
  return { ...DEFAULTS };
}

export function useMapOverlays() {
  const [overlays, setOverlays] = useState(loadOverlays);

  const toggle = (key) => {
    setOverlays((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return { overlays, toggle };
}

export const POI_OVERLAY_MAP = {
  fuel: 'fuel',
  food: 'food',
  pub: 'food',
  workshop: 'services',
  dealership: 'services',
};