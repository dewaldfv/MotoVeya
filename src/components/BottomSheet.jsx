import { X } from 'lucide-react';

export default function BottomSheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-card p-6 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
        {title && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <h3 className="text-xl font-bold leading-tight">{title}</h3>
            <button onClick={onClose} className="glove-target flex shrink-0 items-center justify-center rounded-full bg-secondary">
              <X size={20} />
            </button>
          </div>
        )}
        {children}
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}