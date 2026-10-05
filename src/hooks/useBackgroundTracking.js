import { useRef, useEffect, useState, useCallback } from 'react';

const GPS_CONFIGS = {
  navigating: { enableHighAccuracy: true, maximumAge: 500, timeout: 8000 },
  // Ride Mode must remain high-accuracy even when the platform reports 0 km/h.
  // Android/WebView frequently omits coords.speed while the rider is moving.
  riding: { enableHighAccuracy: true, maximumAge: 500, timeout: 10000 },
  stationary: { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
};

const STATIONARY_DELAY = 30000;
const GPS_WEAK_THRESHOLD = 15000;

export function useBackgroundTracking({ enabled, isActive, isNavigating, stats }) {
  const [isBackground, setIsBackground] = useState(false);
  const [gpsMode, setGpsMode] = useState('riding');
  const [gpsWeak, setGpsWeak] = useState(false);

  const statsRef = useRef(stats);
  const isActiveRef = useRef(isActive);
  const isNavigatingRef = useRef(isNavigating);
  const wakeLockRef = useRef(null);
  const notifIntervalRef = useRef(null);
  const lastGpsRef = useRef(Date.now());
  const lowSpeedSinceRef = useRef(null);

  useEffect(() => { statsRef.current = stats; }, [stats]);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { isNavigatingRef.current = isNavigating; }, [isNavigating]);

  // Wake Lock — keeps GPS/CPU active when screen is off or app is in pocket
  useEffect(() => {
    if (!enabled || !isActive || !('wakeLock' in navigator)) return;
    let released = false;
    const acquire = async () => {
      try { wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch (e) {}
    };
    acquire();
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !released) acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null; }
    };
  }, [enabled, isActive]);

  // Track background state
  useEffect(() => {
    const onVisibility = () => setIsBackground(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Persistent notification with ride stats — tap to reopen
  useEffect(() => {
    if (!enabled || !isActive || !('Notification' in window)) return;

    const updateNotif = () => {
      const s = statsRef.current || { speed: 0, duration: 0, distance: 0 };
      const hrs = Math.floor(s.duration / 3600);
      const mins = Math.floor((s.duration % 3600) / 60);
      const secs = s.duration % 60;
      const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m ${secs}s`;
      const body = `${timeStr} · ${s.distance.toFixed(1)} km · ${s.speed} km/h`;

      if (Notification.permission === 'granted') {
        try {
          const n = new Notification('🏍️ Ride in Progress', {
            body, tag: 'motogo-ride', silent: true, requireInteraction: true,
          });
          n.onclick = () => { window.focus(); n.close(); };
        } catch (e) {}
      }
    };

    const init = async () => {
      if (Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch (e) {}
      }
      updateNotif();
    };
    init();
    notifIntervalRef.current = setInterval(updateNotif, 30000);

    return () => {
      if (notifIntervalRef.current) { clearInterval(notifIntervalRef.current); notifIntervalRef.current = null; }
    };
  }, [enabled, isActive]);

  // Battery-optimised GPS mode: high accuracy navigating, balanced riding, reduced when stationary
  useEffect(() => {
    if (!enabled || !isActive) { setGpsMode('riding'); lowSpeedSinceRef.current = null; return; }

    const interval = setInterval(() => {
      const s = statsRef.current || { speed: 0 };
      const nav = isNavigatingRef.current;

      // Never downgrade an active ride to a low-frequency GPS profile.
      // Android/WebView can report coords.speed as 0/null while the rider is moving.
      setGpsMode(nav ? 'navigating' : 'riding');
      lowSpeedSinceRef.current = null;
    }, 5000);

    return () => clearInterval(interval);
  }, [enabled, isActive]);

  // GPS signal weakness detection for dead reckoning fallback
  useEffect(() => {
    if (!enabled || !isActive) { setGpsWeak(false); return; }
    const interval = setInterval(() => {
      if (Date.now() - lastGpsRef.current > GPS_WEAK_THRESHOLD) setGpsWeak(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [enabled, isActive]);

  const markGpsUpdate = useCallback(() => {
    lastGpsRef.current = Date.now();
    setGpsWeak(false);
  }, []);

  return { isBackground, gpsMode, gpsConfig: GPS_CONFIGS[gpsMode], gpsWeak, markGpsUpdate };
}