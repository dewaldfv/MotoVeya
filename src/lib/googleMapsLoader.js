import { useState, useEffect } from 'react';

const API_KEY = 'AIzaSyBAjSPAjCOCRj1LWq4BQ5iZLykHk6H5rPI';
const LIBRARIES = ['geometry', 'marker'];

let loadPromise = null;

function loadScript() {
  if (typeof window !== 'undefined' && window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const callbackName = '__googleMapsInit';
    window[callbackName] = () => {
      resolve(window.google.maps);
      delete window[callbackName];
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&v=weekly&libraries=${LIBRARIES.join(',')}&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load Google Maps'));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

/**
 * Returns true once the Google Maps JS API script has finished loading.
 * Safe to call from any component; the script is loaded only once.
 */
export function useGoogleMapsLoaded() {
  const [isLoaded, setIsLoaded] = useState(() => {
    return typeof window !== 'undefined' && !!window.google?.maps;
  });

  useEffect(() => {
    if (isLoaded) return;
    let active = true;
    loadScript()
      .then(() => { if (active) setIsLoaded(true); })
      .catch((e) => { console.error('Google Maps load error:', e); });
    return () => { active = false; };
  }, [isLoaded]);

  return isLoaded;
}

export { loadScript };