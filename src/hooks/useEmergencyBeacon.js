import { useRef, useState, useCallback, useEffect } from 'react';

const SOS_TIMING = [
  200, 200, 200, 200, 200, 500,
  600, 200, 600, 200, 600, 500,
  200, 200, 200, 200, 200, 1000,
];

export function useEmergencyBeacon() {
  const [isActive, setIsActive] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const audioEnabledRef = useRef(true);
  const wakeLockRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const ledTimeoutRef = useRef(null);
  const audioIntervalRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => { audioEnabledRef.current = audioEnabled; }, [audioEnabled]);

  const start = useCallback(async () => {
    setIsActive(true);
    cancelledRef.current = false;

    try { wakeLockRef.current = await navigator.wakeLock?.request('screen'); } catch (e) {}

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.();
      if (caps?.torch) {
        let isOn = false;
        let i = 0;
        const step = async () => {
          if (cancelledRef.current) return;
          isOn = !isOn;
          try { await track.applyConstraints({ advanced: [{ torch: isOn }] }); } catch (e) {}
          const dur = SOS_TIMING[i % SOS_TIMING.length];
          i++;
          ledTimeoutRef.current = setTimeout(step, dur);
        };
        step();
      }
    } catch (e) { console.error('Torch unavailable:', e); }

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const playTone = (freq, dur) => {
        if (!audioCtxRef.current) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.value = 0.5;
        osc.start();
        osc.stop(ctx.currentTime + dur / 1000);
      };
      let isHigh = true;
      audioIntervalRef.current = setInterval(() => {
        if (!audioEnabledRef.current || !audioCtxRef.current) return;
        playTone(isHigh ? 1000 : 600, 300);
        isHigh = !isHigh;
      }, 400);
    } catch (e) { console.error('Audio unavailable:', e); }
  }, []);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    setIsActive(false);
    wakeLockRef.current?.release?.();
    wakeLockRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    clearTimeout(ledTimeoutRef.current);
    clearInterval(audioIntervalRef.current);
    audioCtxRef.current?.close?.();
    audioCtxRef.current = null;
  }, []);

  const toggleAudio = useCallback(() => {
    setAudioEnabled((prev) => !prev);
  }, []);

  return { isActive, audioEnabled, start, stop, toggleAudio };
}