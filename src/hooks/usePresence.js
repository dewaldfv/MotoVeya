import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const INTERVAL_MS = 90_000;
const MIN_GAP_MS = 60_000;
const ONLINE_WINDOW_MS = 3 * 60_000;

export function isOnline(lastSeenAt) {
  if (!lastSeenAt) return false;
  const t = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < ONLINE_WINDOW_MS;
}

// Presence heartbeat: stamps last_seen_at on the current user while the app is
// open, so accepted friends and group members can see a true "Online" indicator.
export function usePresence(isAuthenticated) {
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    const ping = async () => {
      if (Date.now() - lastSentRef.current < MIN_GAP_MS) return;
      lastSentRef.current = Date.now();
      try {
        await base44.auth.updateMe({ last_seen_at: new Date().toISOString() });
      } catch (e) {
        /* silent — presence is best-effort */
      }
    };

    ping();
    const interval = setInterval(ping, INTERVAL_MS);

    const onVisible = () => { if (!document.hidden) ping(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [isAuthenticated]);
}