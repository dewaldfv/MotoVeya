import { useState, useEffect, useRef } from 'react';

/**
 * Detects screen orientation changes using the Screen Orientation API,
 * with fallbacks for older browsers. On each change it dispatches a
 * `motogo-orientation-change` custom event and a delayed `resize` event
 * so maps, grids, and dimension-aware components recalculate cleanly.
 */
export function useScreenOrientation() {
  const getOrientationState = () => {
    let type = 'portrait-primary';
    let angle = 0;

    if (typeof screen !== 'undefined' && screen.orientation) {
      type = screen.orientation.type;
      angle = screen.orientation.angle || 0;
    } else if (typeof window !== 'undefined') {
      if (window.matchMedia && window.matchMedia('(orientation: landscape)').matches) {
        type = 'landscape-primary';
      }
      if (typeof window.orientation === 'number') {
        angle = window.orientation;
      }
    }

    return { type, angle };
  };

  const [state, setState] = useState(getOrientationState);
  const lastTypeRef = useRef(state.type);

  useEffect(() => {
    let resizeTimeout;

    const fireChange = (newState) => {
      lastTypeRef.current = newState.type;
      setState(newState);
      window.dispatchEvent(new CustomEvent('motogo-orientation-change', { detail: newState }));
      // Defer resize so the browser finishes the rotation animation first;
      // this lets Leaflet and other resize listeners pick up the new dimensions.
      setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
    };

    const handleOrientationChange = () => {
      fireChange(getOrientationState());
    };

    // Primary: Screen Orientation API
    if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.addEventListener === 'function') {
      screen.orientation.addEventListener('change', handleOrientationChange);
    } else {
      window.addEventListener('orientationchange', handleOrientationChange);
    }

    // Fallback: detect orientation flips via debounced resize (for browsers without the API)
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const newState = getOrientationState();
        if (newState.type !== lastTypeRef.current) {
          fireChange(newState);
        }
      }, 200);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.removeEventListener === 'function') {
        screen.orientation.removeEventListener('change', handleOrientationChange);
      }
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  const isLandscape = state.type.startsWith('landscape');
  const isPortrait = state.type.startsWith('portrait');

  return { orientation: state.type, angle: state.angle, isLandscape, isPortrait };
}