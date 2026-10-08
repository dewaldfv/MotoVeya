import { useRef, useEffect, useState } from 'react';

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
  const indicatorTimesRef = useRef({ highGForce: 0, highRotation: 0, suddenDecel: 0 });
  const recentSpeedsRef = useRef([]);
  const lastMotionRef = useRef({ gForce: 0, rotation: 0, time: 0 });
  const cooldownRef = useRef(0);
  const speedRef = useRef(speed);
  const onCrashRef = useRef(onCrashDetected);
  const [preferenceEnabled, setPreferenceEnabled] = useState(() => {
    try { return localStorage.getItem('motogo_crash_detection_enabled') !== 'false'; } catch { return true; }
  });

  useEffect(() => {
    const refreshPreference = () => {
      try { setPreferenceEnabled(localStorage.getItem('motogo_crash_detection_enabled') !== 'false'); } catch { setPreferenceEnabled(true); }
    };
    window.addEventListener('motoveya:crash-detection-changed', refreshPreference);
    window.addEventListener('storage', refreshPreference);
    return () => {
      window.removeEventListener('motoveya:crash-detection-changed', refreshPreference);
      window.removeEventListener('storage', refreshPreference);
    };
  }, []);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { onCrashRef.current = onCrashDetected; }, [onCrashDetected]);

  const checkTrigger = useRef((gForce, decel) => {
    const now = Date.now();
    const currentSpeed = Number(speedRef.current) || 0;
    if (now <= cooldownRef.current || currentSpeed < MIN_CRASH_SPEED) return;

    // Only correlate indicators that occurred close together.
    const activeIndicators = Object.entries(indicatorTimesRef.current)
      .filter(([, time]) => time > 0 && now - time <= INDICATOR_WINDOW)
      .map(([name]) => name);

    const activeCount = activeIndicators.length;
    const hasImpact = activeIndicators.includes('highGForce');
    const hasRotation = activeIndicators.includes('highRotation');
    const hasDecel = activeIndicators.includes('suddenDecel');

    // A crash requires an impact/deceleration event plus corroborating motion.
    // Rotation alone can be caused by normal riding and is never sufficient.
    const corroborated = (hasImpact && (hasDecel || hasRotation)) || (hasDecel && hasRotation);

    if (!corroborated) return;

    const strongestG = Math.max(gForce || 0, lastMotionRef.current.gForce || 0);
    const strongestRotation = lastMotionRef.current.rotation || 0;
    const severity = calculateSeverity(activeCount, strongestG, decel, currentSpeed);

    cooldownRef.current = now + 60000;
    onCrashRef.current?.({
      indicators: { ...indicatorsRef.current },
      severity,
      gForce: strongestG,
      decel,
      speed: currentSpeed,
      rotation: strongestRotation,
    });

    indicatorsRef.current = { highGForce: false, highRotation: false, suddenDecel: false };
    indicatorTimesRef.current = { highGForce: 0, highRotation: 0, suddenDecel: 0 };
  }).current;

  useEffect(() => {
    if (!enabled || !preferenceEnabled) return;

    const speedInterval = setInterval(() => {
      const now = Date.now();
      recentSpeedsRef.current.push({ speed: speedRef.current, time: now });
      recentSpeedsRef.current = recentSpeedsRef.current.filter((s) => now - s.time < 3000);

      if (recentSpeedsRef.current.length >= 2) {
        const oldest = recentSpeedsRef.current[0];
        const newest = recentSpeedsRef.current[recentSpeedsRef.current.length - 1];
        const drop = oldest.speed - newest.speed;
        if (drop > DECEL_MODERATE && oldest.speed >= MIN_CRASH_SPEED) {
          indicatorsRef.current.suddenDecel = true;
          indicatorTimesRef.current.suddenDecel = now;
          checkTrigger(0, drop);
          setTimeout(() => {
            if (Date.now() - indicatorTimesRef.current.suddenDecel >= INDICATOR_WINDOW) {
              indicatorsRef.current.suddenDecel = false;
              indicatorTimesRef.current.suddenDecel = 0;
            }
          }, INDICATOR_WINDOW + 50);
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
          indicatorTimesRef.current.highGForce = Date.now();
          lastMotionRef.current = { ...lastMotionRef.current, gForce, time: Date.now() };
          checkTrigger(gForce, 0);
          setTimeout(() => {
            if (Date.now() - indicatorTimesRef.current.highGForce >= INDICATOR_WINDOW) {
              indicatorsRef.current.highGForce = false;
              indicatorTimesRef.current.highGForce = 0;
            }
          }, INDICATOR_WINDOW + 50);
        }
      }

      const rot = e.rotationRate;
      if (rot) {
        const rotMag = Math.sqrt((rot.alpha || 0) ** 2 + (rot.beta || 0) ** 2 + (rot.gamma || 0) ** 2);
        if (rotMag > ROTATION_HIGH) {
          indicatorsRef.current.highRotation = true;
          indicatorTimesRef.current.highRotation = Date.now();
          lastMotionRef.current = { ...lastMotionRef.current, rotation: rotMag, time: Date.now() };
          checkTrigger(gForce, 0);
          setTimeout(() => {
            if (Date.now() - indicatorTimesRef.current.highRotation >= INDICATOR_WINDOW) {
              indicatorsRef.current.highRotation = false;
              indicatorTimesRef.current.highRotation = 0;
            }
          }, INDICATOR_WINDOW + 50);
        }
      }
    };

    window.addEventListener('devicemotion', handleMotion);

    return () => {
      clearInterval(speedInterval);
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [enabled, preferenceEnabled, checkTrigger]);
}

export async function requestMotionPermission() {
  if (typeof DeviceMotionEvent === 'undefined') return false;
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      return (await DeviceMotionEvent.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}