import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Surfaces removal notices an admin sent about this rider's events or service
// listings, including the reason. Stays until the rider dismisses it.
export default function RemovalNoticeBanner() {
  const [notices, setNotices] = useState([]);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await base44.auth.isAuthenticated() ? base44.auth.me() : null),
  });

  useEffect(() => {
    if (!me?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const unread = await base44.entities.Notification.filter(
          { recipient_id: me.id, type: 'removal_notice', is_read: false },
          '-created_date',
          5
        );
        if (!cancelled) setNotices(unread || []);
      } catch (e) {
        console.error('removal notices', e);
      }
    })();
    return () => { cancelled = true; };
  }, [me?.id]);

  useEffect(() => {
    if (!me?.id) return;
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (event.type !== 'create') return;
      const n = event.data;
      if (!n || n.recipient_id !== me.id || n.type !== 'removal_notice') return;
      setNotices((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev].slice(0, 5)));
    });
    return unsubscribe;
  }, [me?.id]);

  const dismiss = async (id) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
    try {
      await base44.entities.Notification.update(id, { is_read: true });
    } catch (e) {
      console.error('dismiss removal notice', e);
    }
  };

  if (notices.length === 0) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[95] mx-auto flex max-w-xl flex-col gap-2 px-3"
      style={{ paddingTop: 'calc(0.65rem + env(safe-area-inset-top))' }}
    >
      {notices.map((n) => (
        <div key={n.id} className="rounded-2xl border border-destructive/40 bg-card p-3 shadow-lg">
          <div className="flex items-start gap-2.5">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{n.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(n.id)}
              aria-label="Dismiss notice"
              className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}