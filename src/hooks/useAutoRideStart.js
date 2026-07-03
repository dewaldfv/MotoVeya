import { useRef, useEffect } from 'react';
import { haversine } from '@/lib/navigation';

const SPEED_THRESHOLD = 15;
const SPEED_DURATION = 10000;
const ACCURACY_THRESHOLD = 20;
const MIN_DISTANCE_KM = 0.03;
const COOLDOWN = 120000;

export function useAutoRideStart({ enabled, onAutoStart }) {
  const historyRef = useRef([]);
  const firstPosRef = useRef(null);
  const lastTriggerRef = useRef(0);
  const triggeredRef = useRef(false);
  const onAutoStartRef = useRef(onAutoStart);

  useEffect(() => { onAutoStartRef.current = onAutoStart; }, [onAutoStart]);

  useEffect(() => {
    if (!enabled || triggeredRef.current || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        const rawSpeed = pos.coords.speed;
        const speed = rawSpeed != null && rawSpeed > 0 ? rawSpeed * 3.6 : 0;
        const accuracy = pos.coords.accuracy || 999;
        const newPos = [pos.coords.latitude, pos.coords.longitude];

        if (accuracy > ACCURACY_THRESHOLD) return;

        if (speed < SPEED_THRESHOLD) {
          historyRef.current = [];
          firstPosRef.current = null;
          return;
        }

        historyRef.current.push({ time: now, pos: newPos });
        if (!firstPosRef.current) firstPosRef.current = newPos;
        historyRef.current = historyRef.current.filter((e) => now - e.time <= SPEED_DURATION);

        if (historyRef.current.length < 2) return;
        const oldest = historyRef.current[0];
        if (now - oldest.time < SPEED_DURATION) return;

        const dist = haversine(firstPosRef.current[0], firstPosRef.current[1], newPos[0], newPos[1]);
        if (dist < MIN_DISTANCE_KM) return;

        if (now - lastTriggerRef.current > COOLDOWN) {
          lastTriggerRef.current = now;
          triggeredRef.current = true;
          onAutoStartRef.current?.();
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);
}