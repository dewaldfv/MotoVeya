import { useRef, useEffect } from 'react';
import { haversine } from '@/lib/navigation';

// Auto-start rules:
// - Speed must reach 15 km/h
// - Movement must be sustained for 4 seconds — measured from an explicit window
//   start, so a window that is pruned of old samples can never stall the trigger
// - Most samples in the window must confirm the threshold, so a single GPS spike
//   still cannot start a Ride Mode
// - Speed must drop below 6 km/h before the window restarts (a brief dip mid-ride
//   no longer throws away the whole attempt)
const SPEED_THRESHOLD = 15;
const SPEED_FLOOR = 6;
const WINDOW_MS = 4000;
const MIN_SAMPLES = 3;
const CONSISTENCY_RATIO = 0.6;
const ACCURACY_THRESHOLD = 60;
const MIN_DISTANCE_KM = 0.008;
const COOLDOWN = 120000;

export function useAutoRideStart({ enabled, onAutoStart }) {
  const historyRef = useRef([]);
  const windowStartRef = useRef(null);
  const firstPosRef = useRef(null);
  const lastPosRef = useRef(null);
  const lastTriggerRef = useRef(0);
  const triggeredRef = useRef(false);
  const onAutoStartRef = useRef(onAutoStart);
  const watchIdRef = useRef(null);

  useEffect(() => { onAutoStartRef.current = onAutoStart; }, [onAutoStart]);

  const resetWindow = () => {
    historyRef.current = [];
    windowStartRef.current = null;
    firstPosRef.current = null;
  };

  // A new idle period is a new opportunity to auto-start.
  // Without this reset, the first automatic ride permanently disabled future auto-starts.
  useEffect(() => {
    if (!enabled) {
      resetWindow();
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
        if (accuracy > ACCURACY_THRESHOLD) return;
        const newPos = [pos.coords.latitude, pos.coords.longitude];

        // Prefer the OS-reported speed, but calculate speed from GPS positions when
        // Android/WebView reports null/0 (a common cause of delayed auto-start).
        let speed = pos.coords.speed != null && Number.isFinite(pos.coords.speed)
          ? Math.max(0, pos.coords.speed * 3.6)
          : 0;

        const previous = lastPosRef.current;
        if (previous && now > previous.time) {
          const elapsedSeconds = (now - previous.time) / 1000;
          if (elapsedSeconds > 0.2 && elapsedSeconds < 15) {
            const distanceKm = haversine(previous.pos[0], previous.pos[1], newPos[0], newPos[1]);
            if (speed < 1) speed = (distanceKm / elapsedSeconds) * 3600;
          }
        }
        lastPosRef.current = { time: now, pos: newPos };

        // The rider has come to a stop: the attempt starts over.
        if (speed < SPEED_FLOOR) {
          resetWindow();
          return;
        }

        if (!windowStartRef.current) {
          windowStartRef.current = now;
          firstPosRef.current = newPos;
        }

        historyRef.current.push({ time: now, speed });
        historyRef.current = historyRef.current.filter((entry) => now - entry.time <= WINDOW_MS);

        if (now - windowStartRef.current < WINDOW_MS) return;
        if (historyRef.current.length < MIN_SAMPLES) return;

        // Most retained samples must confirm movement above 15 km/h.
        // A single spike is a minority of the window, so it never triggers.
        const movingSamples = historyRef.current.filter((entry) => entry.speed >= SPEED_THRESHOLD).length;
        if (movingSamples / historyRef.current.length < CONSISTENCY_RATIO) return;

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
          if (watchIdRef.current != null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          onAutoStartRef.current?.();
        }
      },
      () => {},
      {
        enableHighAccuracy: true,
        // Never reuse a cached fix: a stale position makes the start feel late.
        maximumAge: 0,
        timeout: 15000,
      }
    );

    watchIdRef.current = watchId;
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled]);
}