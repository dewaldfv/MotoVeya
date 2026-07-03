import { useRef, useEffect } from 'react';

export function useCrashDetection({ enabled, speed, onCrashDetected }) {
  const indicatorsRef = useRef({ highGForce: false, highRotation: false, suddenDecel: false });
  const recentSpeedsRef = useRef([]);
  const cooldownRef = useRef(0);
  const speedRef = useRef(speed);
  const onCrashRef = useRef(onCrashDetected);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { onCrashRef.current = onCrashDetected; }, [onCrashDetected]);

  const checkTrigger = useRef(() => {
    const activeCount = Object.values(indicatorsRef.current).filter(Boolean).length;
    if (activeCount >= 2 && Date.now() > cooldownRef.current) {
      cooldownRef.current = Date.now() + 60000;
      onCrashRef.current?.({ indicators: { ...indicatorsRef.current } });
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
          checkTrigger();
        }
      }
    }, 500);

    const handleMotion = (e) => {
      const acc = e.accelerationIncludingGravity;
      if (acc) {
        const mag = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
        if (mag > 35) {
          indicatorsRef.current.highGForce = true;
          setTimeout(() => { indicatorsRef.current.highGForce = false; }, 2000);
          checkTrigger();
        }
      }

      const rot = e.rotationRate;
      if (rot) {
        const rotMag = Math.sqrt((rot.alpha || 0) ** 2 + (rot.beta || 0) ** 2 + (rot.gamma || 0) ** 2);
        if (rotMag > 300) {
          indicatorsRef.current.highRotation = true;
          setTimeout(() => { indicatorsRef.current.highRotation = false; }, 2000);
          checkTrigger();
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