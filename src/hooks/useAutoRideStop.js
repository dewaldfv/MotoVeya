import { useRef, useEffect } from 'react';
import { haversine } from '@/lib/navigation';

// Auto-stop is deliberately conservative enough to avoid stopping at normal traffic lights.
const STOP_SPEED = 5; // km/h
const STATIONARY_DURATION = 60000; // 1 minute
const STATIONARY_RADIUS_KM = 0.04; // 40m GPS movement tolerance
const MOVEMENT_CANCEL_SPEED = 10; // km/h

export function useAutoRideStop({ enabled, isActive, speed, userPos, onPromptStop, isCountingDown }) {
  const stationaryStartRef = useRef(null);
  const stationaryCenterRef = useRef(null);
  const lastPosRef = useRef(null);
  const promptShownRef = useRef(false);

  const speedRef = useRef(speed);
  const userPosRef = useRef(userPos);
  const isCountingDownRef = useRef(isCountingDown);
  const onPromptStopRef = useRef(onPromptStop);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { userPosRef.current = userPos; }, [userPos]);
  useEffect(() => { isCountingDownRef.current = isCountingDown; }, [isCountingDown]);
  useEffect(() => { onPromptStopRef.current = onPromptStop; }, [onPromptStop]);

  useEffect(() => {
    if (!enabled || !isActive) {
      stationaryStartRef.current = null;
      stationaryCenterRef.current = null;
      lastPosRef.current = null;
      promptShownRef.current = false;
      return;
    }

    const interval = setInterval(() => {
      if (isCountingDownRef.current || promptShownRef.current) return;

      const currentSpeed = Number(speedRef.current) || 0;
      const currentPos = userPosRef.current;

      // A reliable moving-speed reading cancels stationary detection immediately.
      if (currentSpeed >= MOVEMENT_CANCEL_SPEED) {
        stationaryStartRef.current = null;
        stationaryCenterRef.current = null;
        lastPosRef.current = currentPos;
        return;
      }

      // GPS displacement is a fallback when the browser reports 0/null speed.
      let gpsMoving = false;
      if (lastPosRef.current && currentPos) {
        const distFromLastSample = haversine(
          lastPosRef.current[0],
          lastPosRef.current[1],
          currentPos[0],
          currentPos[1]
        );
        gpsMoving = distFromLastSample > 0.003; // >3m between samples
      }
      lastPosRef.current = currentPos;

      if (currentSpeed >= STOP_SPEED || gpsMoving) {
        stationaryStartRef.current = null;
        stationaryCenterRef.current = null;
        return;
      }

      // Only start the stationary timer below 5 km/h.
      if (!stationaryStartRef.current) {
        stationaryStartRef.current = Date.now();
        stationaryCenterRef.current = currentPos;
        return;
      }

      if (stationaryCenterRef.current && currentPos) {
        const dist = haversine(
          stationaryCenterRef.current[0],
          stationaryCenterRef.current[1],
          currentPos[0],
          currentPos[1]
        );

        // Ignore GPS drift / movement beyond 40m.
        if (dist > STATIONARY_RADIUS_KM) {
          stationaryStartRef.current = Date.now();
          stationaryCenterRef.current = currentPos;
          return;
        }
      }

      if (Date.now() - stationaryStartRef.current >= STATIONARY_DURATION) {
        promptShownRef.current = true;
        onPromptStopRef.current?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled, isActive]);

  useEffect(() => {
    if (!isCountingDown) {
      promptShownRef.current = false;
      stationaryStartRef.current = null;
      stationaryCenterRef.current = null;
      lastPosRef.current = userPosRef.current;
    }
  }, [isCountingDown]);
}