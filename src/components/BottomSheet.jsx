import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { nextOverlayId, registerOverlay, unregisterOverlay } from '@/lib/overlayManager';

export default function BottomSheet({ open, onClose, title, children, backgroundImage, immersive = false }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const id = nextOverlayId();
    registerOverlay(id, () => onCloseRef.current?.());
    return () => unregisterOverlay(id);
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end landscape:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className={`relative max-h-[80vh] w-full overflow-y-auto rounded-t-3xl p-6 pb-8 shadow-2xl landscape:max-h-[65vh] landscape:max-w-2xl landscape:mx-auto landscape:rounded-3xl ${immersive ? 'bg-transparent text-white' : 'bg-card'}`}
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {immersive && backgroundImage && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${backgroundImage})` }} />
            <div className="pointer-events-none absolute inset-0 bg-black/65" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-black/45 to-black/80" />
          </>
        )}
        <div className={`relative z-10 mx-auto mb-4 h-1.5 w-12 rounded-full ${immersive ? 'bg-white/50' : 'bg-muted'}`} />
        {title && (
          <div className="relative z-10 mb-4 flex items-start justify-between gap-3">
            <h3 className="text-xl font-bold leading-tight">{title}</h3>
            <button onClick={onClose} className={`glove-target flex shrink-0 items-center justify-center rounded-full ${immersive ? 'bg-white/15 text-white backdrop-blur-md' : 'bg-secondary'}`}>
              <X size={20} />
            </button>
          </div>
        )}
        <div className="relative z-10">{children}</div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}