import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const BROADCAST_INTERVAL_MS = 10000;

/**
 * Broadcasts the current user's live GPS position to the backend so friends
 * can see their movement on the map. Respects the user's privacy setting
 * (share_live_location) — the backend clears location if sharing is off.
 */
export function useLocationBroadcast() {
  const lastBroadcastRef = useRef(0);
  const latestPosRef = useRef(null);
  const authedRef = useRef(false);

  useEffect(() => {
    let watchId = null;
    let intervalId = null;

    base44.auth.isAuthenticated().then((ok) => { authedRef.current = ok; });

    const broadcast = async () => {
      if (!authedRef.current) return;
      const pos = latestPosRef.current;
      if (!pos) return;
      const now = Date.now();
      if (now - lastBroadcastRef.current < BROADCAST_INTERVAL_MS) return;
      lastBroadcastRef.current = now;
      try {
        await base44.functions.invoke('update-my-location', { lat: pos.lat, lng: pos.lng });
      } catch (e) { /* silent — will retry next interval */ }
    };

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => { latestPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    }

    intervalId = setInterval(broadcast, BROADCAST_INTERVAL_MS);

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);
}