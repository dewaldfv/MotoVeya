import { useEffect, useRef, useState } from 'react';
import { Layers, Maximize2, Minimize2, Check } from 'lucide-react';
import { MAP_LAYERS } from '@/lib/mapLayers';

/**
 * Compact floating controls for the ride planner map: expand to fullscreen and
 * switch the map layer. Sits over the top-right corner of the map.
 */
export default function PlannerMapControls({ rawLayer, onSelectLayer, fullscreen, onToggleFullscreen }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const button = 'flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-md backdrop-blur-md transition active:scale-95';

  return (
    <div
      ref={ref}
      className="absolute right-3 z-20 flex flex-col items-end gap-2"
      style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Map layers"
        title="Map layers"
        className={button}
      >
        <Layers size={18} className={open ? 'text-primary' : undefined} />
      </button>

      <button
        type="button"
        onClick={onToggleFullscreen}
        aria-label={fullscreen ? 'Exit fullscreen map' : 'Fullscreen map'}
        title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        className={button}
      >
        {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>

      {open && (
        <div className="w-48 overflow-hidden rounded-2xl border border-border bg-card/95 p-1.5 shadow-xl backdrop-blur-md">
          {MAP_LAYERS.map((l) => {
            const isActive = rawLayer === l.key;
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => { onSelectLayer(l.key); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors ${isActive ? 'bg-primary/10' : 'hover:bg-secondary'}`}
              >
                <span
                  className="h-6 w-6 shrink-0 rounded-lg border border-border"
                  style={{ background: l.preview }}
                />
                <span className={`flex-1 text-xs font-semibold ${isActive ? 'text-primary' : 'text-foreground'}`}>
                  {l.label}
                </span>
                {isActive && <Check size={14} className="text-primary" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}