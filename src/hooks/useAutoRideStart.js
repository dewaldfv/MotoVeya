import { useRef, useEffect } from 'react';
import { haversine } from '@/lib/navigation';

// Auto-start rules:
// - Rider must be moving at >15 km/h
// - Movement must remain above the threshold for 10 seconds
// - GPS must be reasonably accurate
// - A short GPS speed spike must not trigger Ride Mode
const SPEED_THRESHOLD = 15;
const SPEED_DURATION = 10000;
const ACCURACY_THRESHOLD = 50;
const MIN_DISTANCE_KM = 0.03;
const COOLDOWN = 120000;

export function useAutoRideStart({ enabled, onAutoStart }) {
  const historyRef = useRef([]);
  const firstPosRef = useRef(null);
  const lastPosRef = useRef(null);
  const lastTriggerRef = useRef(0);
  const triggeredRef = useRef(false);
  const onAutoStartRef = useRef(onAutoStart);

  useEffect(() => { onAutoStartRef.current = onAutoStart; }, [onAutoStart]);

  // A new idle period is a new opportunity to auto-start.
  // Without this reset, the first automatic ride permanently disabled future auto-starts.
  useEffect(() => {
    if (!enabled) {
      historyRef.current = [];
      firstPosRef.current = null;
      lastPosRef.current = null;
      triggeredRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || triggeredRef.current || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        const accuracy = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : 999;
        const newPos = [pos.coords.latitude, pos.coords.longitude];

        if (accuracy > ACCURACY_THRESHOLD) return;

        // Prefer the OS-reported speed, but calculate speed from GPS positions when
        // Android/WebView reports null/0 (a common cause of delayed auto-start).
        let speed = pos.coords.speed != null && Number.isFinite(pos.coords.speed)
          ? Math.max(0, pos.coords.speed * 3.6)
          : 0;

        const previous = lastPosRef.current;
        if (previous && previous.time < now) {
          const distanceKm = haversine(previous.pos[0], previous.pos[1], newPos[0], newPos[1]);
          const elapsedSeconds = (now - previous.time) / 1000;
          if (elapsedSeconds > 0 && distanceKm >= 0) {
            const calculatedSpeed = (distanceKm / elapsedSeconds) * 3600;
            // GPS-derived speed is useful when the platform speed is unavailable.
            if (speed < 1) speed = calculatedSpeed;
          }
        }

        lastPosRef.current = { time: now, pos: newPos };

        if (speed < SPEED_THRESHOLD) {
          historyRef.current = [];
          firstPosRef.current = null;
          return;
        }

        if (!firstPosRef.current) firstPosRef.current = newPos;

        historyRef.current.push({ time: now, pos: newPos, speed });
        historyRef.current = historyRef.current.filter(
          (entry) => now - entry.time <= SPEED_DURATION
        );

        if (historyRef.current.length < 2) return;

        const oldest = historyRef.current[0];
        if (now - oldest.time < SPEED_DURATION) return;

        // Every retained sample must confirm movement above 15 km/h.
        // This prevents a single GPS spike from starting a ride.
        const consistentlyMoving = historyRef.current.every(
          (entry) => entry.speed >= SPEED_THRESHOLD
        );
        if (!consistentlyMoving) {
          historyRef.current = [];
          firstPosRef.current = null;
          return;
        }

        const dist = haversine(
          firstPosRef.current[0],
          firstPosRef.current[1],
          newPos[0],
          newPos[1]
        );
        if (dist < MIN_DISTANCE_KM) return;

        if (now - lastTriggerRef.current > COOLDOWN) {
          lastTriggerRef.current = now;
          triggeredRef.current = true;
          onAutoStartRef.current?.();
        }
      },
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);
}