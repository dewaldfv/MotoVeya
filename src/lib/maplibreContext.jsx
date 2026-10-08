import { createContext, useContext } from 'react';

/**
 * Provides the live MapLibre GL map instance and a styleVersion counter
 * (incremented every time the style is reloaded) to child components.
 *
 * Replaces `useGoogleMap()` from @react-google-maps/api.
 */
const MapContext = createContext({ map: null, styleVersion: 0 });

export const MapProvider = MapContext.Provider;

export function useMapInstance() {
  return useContext(MapContext).map;
}

export function useMapStyleVersion() {
  return useContext(MapContext).styleVersion;
}