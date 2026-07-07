import { useEffect, useRef } from 'react';
import { buildManeuverInstruction, speak } from '@/lib/voiceNav';

// Distance thresholds (meters) at which to announce the upcoming maneuver.
// Sorted descending; each announces once per step.
const THRESHOLDS = [
  { key: 'far', dist: 500, prefix: 'In 500 meters, ' },
  { key: 'near', dist: 100, prefix: 'In 100 meters, ' },
  { key: 'now', dist: 30, prefix: '' },
];

export function useVoiceNavigation({ navProgress, destinationName, enabled }) {
  const lastStepIdxRef = useRef(-1);
  const announcedRef = useRef(new Set());

  useEffect(() => {
    if (!enabled || !navProgress?.nextStep) return;
    const { nextStep, distanceToManeuver, currentStepIdx } = navProgress;

    // When the step advances, reset the announced set. Pre-mark thresholds we
    // are already inside (distance below their trigger) so we don't announce
    // stale "in 500 meters" phrasing when we joined the step already close.
    if (currentStepIdx !== lastStepIdxRef.current) {
      const d = distanceToManeuver;
      const passed = new Set(
        THRESHOLDS.filter((t) => d != null && t.dist >= d).map((t) => t.key)
      );
      announcedRef.current = passed;
      lastStepIdxRef.current = currentStepIdx;
    }

    const instruction = buildManeuverInstruction(nextStep, destinationName);
    if (!instruction || distanceToManeuver == null) return;

    for (const t of THRESHOLDS) {
      if (distanceToManeuver <= t.dist && !announcedRef.current.has(t.key)) {
        announcedRef.current.add(t.key);
        speak(t.prefix + instruction);
        break;
      }
    }
  }, [navProgress, destinationName, enabled]);

  // Stop any in-flight speech when unmounting / leaving navigation.
  useEffect(() => {
    return () => {
      try { window.speechSynthesis?.cancel(); } catch (e) { /* ignore */ }
    };
  }, []);
}