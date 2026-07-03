import { Check } from 'lucide-react';
import BottomSheet from '@/components/BottomSheet';
import { MAP_LAYERS } from '@/lib/mapLayers';
import { MAP_OVERLAYS } from '@/lib/mapOverlays';

export default function LayersSheet({ open, onClose, layer, onSelect, overlays, onToggleOverlay }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Map Layers">
      <div className="grid grid-cols-2 gap-3">
        {MAP_LAYERS.map((l) => {
          const isActive = layer === l.key;
          return (
            <button
              key={l.key}
              onClick={() => { onSelect(l.key); onClose(); }}
              className={`overflow-hidden rounded-2xl border-2 text-left transition-colors ${isActive ? 'border-primary' : 'border-transparent'}`}
            >
              <div className="relative h-20 w-full" style={{ background: l.preview }}>
                {isActive && (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check size={14} />
                  </span>
                )}
              </div>
              <div className="bg-card p-2.5">
                <p className={`text-sm font-bold ${isActive ? 'text-primary' : ''}`}>{l.label}</p>
                <p className="text-[11px] text-muted-foreground">{l.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {overlays && (
        <>
          <p className="mb-2 mt-5 text-sm font-bold">Content Layers</p>
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