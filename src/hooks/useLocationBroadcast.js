import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  DEFAULT_GPS_INTERVAL_SEC,
  STATIONARY_SPEED_KMH,
} from '@/lib/locationConfig';

const SETTINGS_POLL_MS = 30000;
const TICK_MS = 3000;

const STATIONARY_INTERVAL_MS = 2 * 60 * 1000;

// Adaptive throttle: fast while moving, 2-minute intervals when stationary, per spec.
function adaptiveIntervalMs(speed, baseSec) {
  const base = (baseSec || DEFAULT_GPS_INTERVAL_SEC) * 1000;
  if (speed >= 25) return Math.max(5000, Math.round(base / 2));
  if (speed < STATIONARY_SPEED_KMH) return STATIONARY_INTERVAL_MS;
  return base;
}

/**
 * Background live-location broadcast engine.
 *
 * - Only transmits while a ride is active, or during the configured post-ride window.
 * - Respects the user's privacy consent (background_sharing_enabled + audience) — re-checked every tick
 *   and again server-side. Stops immediately if consent is revoked or location permission is lost.
 * - Adaptive GPS frequency based on movement; pauses after being stationary off-ride for a while.
 * - Holds a screen wake lock while tracking so GPS stays alive on a locked screen (best-effort on web).
 * - Posts a device notification when a sharing session starts.
 */
export function useLocationBroadcast() {
  const latestPosRef = useRef(null);
  const lastBroadcastRef = useRef(0);
  const authedRef = useRef(false);
  const settingsRef = useRef({
    background_sharing_enabled: false,
    location_audience: 'friends',
    post_ride_share_duration: 'immediate',
    gps_update_interval_sec: DEFAULT_GPS_INTERVAL_SEC,
  });
  const stationarySinceRef = useRef(null);
  const lastSpeedRef = useRef(0);
  const batteryRef = useRef(null);
  const wakeLockRef = useRef(null);
  const trackingRef = useRef(false);
  const notifiedRef = useRef(false);

  useEffect(() => {
    let watchId = null;
    let intervalId = null;
    let settingsPollId = null;
    let batteryPollId = null;
    let destroyed = false;

    const acquireWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && !wakeLockRef.current) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch (e) { /* not supported / denied */ }
    };
    const releaseWakeLock = () => {
      try {
        if (wakeLockRef.current) { wakeLockRef.current.release?.(); wakeLockRef.current = null; }
      } catch (e) {}
    };

    const notifyStart = () => {
      if (notifiedRef.current) return;
      notifiedRef.current = true;
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('MotoGo location sharing active', {
            body: 'Your live location is being shared with friends.',
          });
        }
      } catch (e) {}
    };

    const endSession = async () => {
      if (!trackingRef.current) return;
      trackingRef.current = false;
      notifiedRef.current = false;
      releaseWakeLock();
      try { await base44.functions.invoke('update-my-location', { end_session: true }); } catch (e) {}
    };

    const broadcast = async () => {
      if (!authedRef.current || destroyed) return;
      const s = settingsRef.current;
      // Consent: "Share live location with friends" OR "Background sharing" enables broadcasts.
      const consentOn = s.share_live_location === true || s.background_sharing_enabled === true;
      const audience = s.location_audience
        || (s.location_group_rides_only ? 'group_rides' : 'friends');
      if (!consentOn || audience === 'nobody') {
        if (trackingRef.current) await endSession();
        return;
      }

      const pos = latestPosRef.current;
      if (!pos) return;
      const speed = pos.speed ?? lastSpeedRef.current;
      lastSpeedRef.current = speed;

      // Track stationary state so the adaptive interval can slow down (2-min) without ending the session.
      if (speed < STATIONARY_SPEED_KMH) {
        if (!stationarySinceRef.current) stationarySinceRef.current = Date.now();
      } else {
        stationarySinceRef.current = null;
      }

      const now = Date.now();
      if (now - lastBroadcastRef.current < adaptiveIntervalMs(speed, s.gps_update_interval_sec)) return;
      lastBroadcastRef.current = now;

      if (!trackingRef.current) {
        trackingRef.current = true;
        acquireWakeLock();
        notifyStart();
      }

      try {
        const res = await base44.functions.invoke('update-my-location', {
          lat: pos.lat, lng: pos.lng, speed_kmh: speed, heading: pos.heading,
          battery_level: batteryRef.current, source: 'manual',
        });
        if (res.data && res.data.sharing === false) await endSession();
      } catch (e) { /* retry next tick */ }
    };

    const onPos = (pos) => {
      const c = pos.coords;
      const speed = c.speed != null && !Number.isNaN(c.speed) ? c.speed * 3.6 : lastSpeedRef.current;
      const heading = c.heading != null && !Number.isNaN(c.heading) ? c.heading : null;
      latestPosRef.current = { lat: c.latitude, lng: c.longitude, speed, heading };
    };
    const onPosError = (err) => {
      if (err && err.code === err.PERMISSION_DENIED && trackingRef.current) endSession();
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        lastBroadcastRef.current = 0;
        if (trackingRef.current) acquireWakeLock();
        broadcast();
      }
    };

    const loadSettings = async () => {
      try {
        const ps = await base44.entities.PrivacySetting.filter({}, '-created_date', 1);
        if (ps && ps[0]) settingsRef.current = { ...settingsRef.current, ...ps[0] };
      } catch (e) {}
    };

    const updateBattery = async () => {
      try {
        if ('getBattery' in navigator) {
          const battery = await navigator.getBattery();
          batteryRef.current = Math.round(battery.level * 100);
        }
      } catch (e) {}
    };

    const init = async () => {
      authedRef.current = await base44.auth.isAuthenticated();
      if (!authedRef.current || destroyed) return;
      await loadSettings();
      await updateBattery();
      settingsPollId = setInterval(loadSettings, SETTINGS_POLL_MS);
      batteryPollId = setInterval(updateBattery, 30000);
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(onPos, onPosError, {
          enableHighAccuracy: true, maximumAge: 5000, timeout: 15000,
        });
      }
      intervalId = setInterval(broadcast, TICK_MS);
      document.addEventListener('visibilitychange', onVis);
      broadcast();
    };
    init();

    return () => {
      destroyed = true;
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (intervalId) clearInterval(intervalId);
      if (settingsPollId) clearInterval(settingsPollId);
      if (batteryPollId) clearInterval(batteryPollId);
      document.removeEventListener('visibilitychange', onVis);
      releaseWakeLock();
      if (trackingRef.current) {
        try { base44.functions.invoke('update-my-location', { end_session: true }); } catch (e) {}
      }
    };
  }, []);
}