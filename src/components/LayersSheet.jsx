import { Check } from 'lucide-react';
import BottomSheet from '@/components/BottomSheet';
import { MAP_LAYERS } from '@/lib/mapLayers';
import { MAP_OVERLAYS } from '@/lib/mapOverlays';

export default function LayersSheet({ open, onClose, layer, onSelect, overlays, onToggleOverlay }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Map Type">
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 no-scrollbar">
        {MAP_LAYERS.filter((l) => !['satellite', 'terrain'].includes(l.key)).map((l) => {
          const isActive = layer === l.key;
          return (
            <button
              key={l.key}
              onClick={() => { onSelect(l.key); onClose(); }}
              className="flex shrink-0 flex-col items-center gap-1.5"
            >
              <div
                className={`relative h-16 w-16 overflow-hidden rounded-2xl border-2 transition-colors ${isActive ? 'border-primary' : 'border-transparent'}`}
                style={{ background: l.preview }}
              >
                {isActive && (
                  <span className="absolute inset-0 flex items-center justify-center bg-primary/25">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                      <Check size={16} strokeWidth={3} />
                    </span>
                  </span>
                )}
              </div>
              <span className={`text-xs font-semibold ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{l.label}</span>
            </button>
          );
        })}
      </div>

      {overlays && (
        <>
          <p className="mb-2 mt-4 text-sm font-bold">Content Layers</p>
          <div className="grid grid-cols-2 gap-2">
            {MAP_OVERLAYS.map((o) => {
              const isActive = overlays[o.key];
              return (
                <button
                  key={o.key}
                  onClick={() => onToggleOverlay?.(o.key)}
                  className={`flex items-center gap-2 rounded-xl p-3 text-left text-sm font-medium transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'}`}
                >
                  <span className="text-lg">{o.emoji}</span>
                  <span className="flex-1 leading-tight">{o.label}</span>
                  <div className={`flex h-5 w-5 items-center justify-center rounded-md border-2 ${isActive ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
                    {isActive && <Check size={12} />}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </BottomSheet>
  );
}