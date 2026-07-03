import { useRef, useEffect, useState, useCallback } from 'react';

const DOUBLE_PRESS_WINDOW = 2000;

export function useEmergencyCancellation({ enabled, onCancel }) {
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);

  const volumeRef = useRef({ up: 0, down: 0 });
  const mediaRef = useRef(0);
  const recognitionRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  const enabledRef = useRef(enabled);

  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const triggerCancel = useCallback((method) => {
    onCancelRef.current?.(method);
  }, []);

  // Hardware volume keys (double-press) + keyboard fallback for testing
  useEffect(() => {
    if (!enabled) return;
    const handleKey = (e) => {
      const isUp = e.code === 'VolumeUp' || e.code === 'ArrowUp';
      const isDown = e.code === 'VolumeDown' || e.code === 'ArrowDown';
      if (!isUp && !isDown) return;
      const now = Date.now();
      const key = isUp ? 'up' : 'down';
      if (now - volumeRef.current[key] < DOUBLE_PRESS_WINDOW) {
        e.preventDefault();
        volumeRef.current[key] = 0;
        triggerCancel(isUp ? 'volume_up' : 'volume_down');
      } else {
        volumeRef.current[key] = now;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [enabled, triggerCancel]);

  // Voice command: "MotoGo, I'm OK"
  useEffect(() => {
    if (!enabled) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setVoiceSupported(true);

    let stopped = false;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onstart = () => setVoiceListening(true);
    recognition.onend = () => {
      setVoiceListening(false);
      if (!stopped && enabledRef.current) {
        try { recognition.start(); } catch (e) {}
      }
    };
    recognition.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stopped = true;
        setVoiceSupported(false);
      }
    };
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase();
        const hasMotoGo = transcript.includes('motogo') || transcript.includes('moto go');
        if (hasMotoGo && transcript.includes('ok')) {
          triggerCancel('voice');
          return;
        }
      }
    };

    try { recognition.start(); } catch (e) {}

    return () => {
      stopped = true;
      try { recognition.stop(); } catch (e) {}
      recognitionRef.current = null;
      setVoiceListening(false);
    };
  }, [enabled, triggerCancel]);

  // Bluetooth headsets / smartwatches via MediaSession (future-ready)
  useEffect(() => {
    if (!enabled || !('mediaSession' in navigator)) return;
    const handleMedia = () => {
      const now = Date.now();
      if (now - mediaRef.current < DOUBLE_PRESS_WINDOW) {
        mediaRef.current = 0;
        triggerCancel('bluetooth');
      } else {
        mediaRef.current = now;
      }
    };
    const actions = ['play', 'pause', 'previoustrack', 'nexttrack'];
    actions.forEach((a) => {
      try { navigator.mediaSession.setActionHandler(a, handleMedia); } catch (e) {}
    });
    if (typeof MediaMetadata !== 'undefined') {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'MotoGo Emergency',
          artist: 'Crash Detection Active',
          album: 'MotoGo',
        });
      } catch (e) {}
    }
    return () => {
      actions.forEach((a) => {
        try { navigator.mediaSession.setActionHandler(a, null); } catch (e) {}
      });
    };
  }, [enabled, triggerCancel]);

  return { voiceSupported, voiceListening };
}