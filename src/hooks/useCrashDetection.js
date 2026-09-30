import { useRef, useEffect } from 'react';

// Crash detection uses correlated signals rather than a single sensor spike.
const G_FORCE_MODERATE = 4.0;
const G_FORCE_MEDIUM = 5.5;
const G_FORCE_HIGH = 8.0;
const ROTATION_HIGH = 360;
const DECEL_MODERATE = 35;
const DECEL_HIGH = 50;
const MIN_CRASH_SPEED = 25;
const HIGH_SPEED = 50;
const IMPACT_WINDOW = 1500;
const INDICATOR_WINDOW = 1500;

function calculateSeverity(activeCount, gForce, decel, speed) {
  if (gForce > G_FORCE_HIGH || (activeCount >= 3 && gForce > G_FORCE_MEDIUM) || decel > DECEL_HIGH) {
    return 'high';
  }
  if (gForce > G_FORCE_MEDIUM || decel > DECEL_MODERATE || (activeCount >= 2 && speed > 40)) {
    return 'medium';
  }
  return 'low';
}

export function useCrashDetection({ enabled, speed, onCrashDetected }) {
  const indicatorsRef = useRef({ highGForce: false, highRotation: false, suddenDecel: false });
  const recentSpeedsRef = useRef([]);
  const cooldownRef = useRef(0);
  const speedRef = useRef(speed);
  const onCrashRef = useRef(onCrashDetected);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { onCrashRef.current = onCrashDetected; }, [onCrashDetected]);

  const checkTrigger = useRef((gForce, decel) => {
    const activeCount = Object.values(indicatorsRef.current).filter(Boolean).length;
    const now = Date.now();
    if (now <= cooldownRef.current) return;

    if (gForce > G_FORCE_HIGH && activeCount >= 1) {
      cooldownRef.current = now + 60000;
      onCrashRef.current?.({
        indicators: { ...indicatorsRef.current },
        severity: 'high',
        gForce,
        decel,
      });
      indicatorsRef.current = { highGForce: false, highRotation: false, suddenDecel: false };
      return;
    }

    if (activeCount >= 2) {
      cooldownRef.current = now + 60000;
      const severity = calculateSeverity(activeCount, gForce, decel, speedRef.current);
      onCrashRef.current?.({
        indicators: { ...indicatorsRef.current },
        severity,
        gForce,
        decel,
      });
      indicatorsRef.current = { highGForce: false, highRotation: false, suddenDecel: false };
    }
  }).current;

  useEffect(() => {
    if (!enabled) return;

    const speedInterval = setInterval(() => {
      const now = Date.now();
      recentSpeedsRef.current.push({ speed: speedRef.current, time: now });
      recentSpeedsRef.current = recentSpeedsRef.current.filter((s) => now - s.time < 3000);

      if (recentSpeedsRef.current.length >= 2) {
        const oldest = recentSpeedsRef.current[0];
        const newest = recentSpeedsRef.current[recentSpeedsRef.current.length - 1];
        const drop = oldest.speed - newest.speed;
        if (drop > 30 && oldest.speed > 20) {
          indicatorsRef.current.suddenDecel = true;
          setTimeout(() => { indicatorsRef.current.suddenDecel = false; }, 2000);
          checkTrigger(0, drop);
        }
      }
    }, 500);

    const handleMotion = (e) => {
      const acc = e.accelerationIncludingGravity;
      let gForce = 0;
      if (acc) {
        const mag = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
        gForce = mag / 9.81;
        if (gForce > G_FORCE_MODERATE) {
          indicatorsRef.current.highGForce = true;
          setTimeout(() => { indicatorsRef.current.highGForce = false; }, 2000);
          checkTrigger(gForce, 0);
        }
      }

      const rot = e.rotationRate;
      if (rot) {
        const rotMag = Math.sqrt((rot.alpha || 0) ** 2 + (rot.beta || 0) ** 2 + (rot.gamma || 0) ** 2);
        if (rotMag > ROTATION_HIGH) {
          indicatorsRef.current.highRotation = true;
          setTimeout(() => { indicatorsRef.current.highRotation = false; }, 2000);
          checkTrigger(gForce, 0);
        }
      }
    };

    window.addEventListener('devicemotion', handleMotion);

    return () => {
      clearInterval(speedInterval);
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [enabled, checkTrigger]);
}

export async function requestMotionPermission() {
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      return (await DeviceMotionEvent.requestPermission()) === 'granted';
    } catch (e) {
      return false;
    }
  }
  return true;
}