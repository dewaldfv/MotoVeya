import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, Siren, AlertTriangle, Navigation, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

const ALERT_TYPES = new Set(['message', 'crash_alert', 'distress_alert', 'ride_invite']);

const TYPE_CONFIG = {
  message: { icon: MessageCircle, color: 'bg-primary', iconColor: 'text-primary-foreground' },
  crash_alert: { icon: AlertTriangle, color: 'bg-destructive', iconColor: 'text-white' },
  distress_alert: { icon: Siren, color: 'bg-destructive', iconColor: 'text-white' },
  ride_invite: { icon: Navigation, color: 'bg-primary', iconColor: 'text-primary-foreground' },
};

export default function NotificationPopUp() {
  const navigate = useNavigate();
  const [popups, setPopups] = useState([]);
  const seenIds = useRef(new Set());
  const timersRef = useRef({});

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await base44.auth.isAuthenticated() ? base44.auth.me() : null),
  });

  useEffect(() => {
    if (!me?.id) return;
    (async () => {
      try {
        const existing = await base44.entities.Notification.filter(
          { recipient_id: me.id, is_read: false },
          '-created_date',
          50
        );
        (existing || []).forEach((n) => seenIds.current.add(n.id));
      } catch (e) {
        /* ignore */
      }
    })();
  }, [me?.id]);

  useEffect(() => {
    if (!me?.id) return;
    const unsub = base44.entities.Notification.subscribe((event) => {
      if (event.type !== 'create') return;
      const n = event.data;
      if (!n || n.recipient_id !== me.id) return;
      if (!ALERT_TYPES.has(n.type)) return;
      if (seenIds.current.has(n.id)) return;
      seenIds.current.add(n.id);

      setPopups((prev) => [
        ...prev,
        { id: n.id, type: n.type, title: n.title, body: n.body, conversation_id: n.conversation_id },
      ]);

      timersRef.current[n.id] = setTimeout(() => {
        setPopups((prev) => prev.filter((p) => p.id !== n.id));
      }, 5000);
    });
    return unsub;
  }, [me?.id]);

  const dismiss = (id) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setPopups((prev) => prev.filter((p) => p.id !== id));
  };

  const handleTap = (popup) => {
    dismiss(popup.id);
    if (popup.type === 'message' && popup.conversation_id) {
      navigate('/community', { state: { tab: 'messages', conversationId: popup.conversation_id } });
    } else if (popup.type === 'ride_invite') {
      navigate('/community', { state: { tab: 'friends' } });
    } else {
      navigate('/');
    }
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4"
      style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
    >
      <AnimatePresence>
        {popups.map((p) => {
          const config = TYPE_CONFIG[p.type] || TYPE_CONFIG.message;
          const Icon = config.icon;
          const isUrgent = p.type === 'crash_alert' || p.type === 'distress_alert';
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: -60, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`pointer-events-auto w-full max-w-md cursor-pointer rounded-2xl shadow-xl ${
                isUrgent ? 'bg-destructive' : 'bg-card'
              }`}
              onClick={() => handleTap(p)}
            >
              <div className="flex items-start gap-3 p-3.5">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.color}`}>
                  <Icon size={20} className={config.iconColor} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold ${isUrgent ? 'text-white' : 'text-foreground'}`}>{p.title}</p>
                  {p.body && (
                    <p className={`mt-0.5 line-clamp-2 text-xs ${isUrgent ? 'text-white/90' : 'text-muted-foreground'}`}>
                      {p.body}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss(p.id);
                  }}
                  className={`shrink-0 rounded-full p-1 ${
                    isUrgent ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}