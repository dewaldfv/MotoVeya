import { useRef, useEffect } from 'react';
import { haversine } from '@/lib/navigation';

const STOP_SPEED = 10;
const STATIONARY_DURATION = 300000;
const STATIONARY_RADIUS_KM = 0.025;

export function useAutoRideStop({ enabled, isActive, speed, userPos, onPromptStop, isCountingDown }) {
  const stationaryStartRef = useRef(null);
  const stationaryCenterRef = useRef(null);
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
      promptShownRef.current = false;
      return;
    }

    const interval = setInterval(() => {
      if (isCountingDownRef.current || promptShownRef.current) return;

      const currentSpeed = speedRef.current;
      const currentPos = userPosRef.current;

      if (currentSpeed < STOP_SPEED) {
        if (!stationaryStartRef.current) {
          stationaryStartRef.current = Date.now();
          stationaryCenterRef.current = currentPos;
        } else if (stationaryCenterRef.current && currentPos) {
          const dist = haversine(stationaryCenterRef.current[0], stationaryCenterRef.current[1], currentPos[0], currentPos[1]);
          if (dist > STATIONARY_RADIUS_KM) {
            stationaryStartRef.current = Date.now();
            stationaryCenterRef.current = currentPos;
          } else if (Date.now() - stationaryStartRef.current >= STATIONARY_DURATION) {
            promptShownRef.current = true;
            onPromptStopRef.current?.();
          }
        }
      } else {
        stationaryStartRef.current = null;
        stationaryCenterRef.current = null;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled, isActive]);

  useEffect(() => {
    if (!isCountingDown) {
      promptShownRef.current = false;
      stationaryStartRef.current = null;
      stationaryCenterRef.current = null;
    }
  }, [isCountingDown]);
}