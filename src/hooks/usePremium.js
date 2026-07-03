import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { isPremiumUser } from '@/lib/plans';

export function usePremium() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) { setUser(null); return; }
      const me = await base44.auth.me();
      setUser(me);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const isPremium = isPremiumUser(user);

  const requirePremium = useCallback((onUpgrade) => {
    if (isPremium) return true;
    if (onUpgrade) onUpgrade();
    return false;
  }, [isPremium]);

  return { isPremium, loading, user, refresh, requirePremium };
}