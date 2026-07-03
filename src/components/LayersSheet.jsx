import { Check } from 'lucide-react';
import BottomSheet from '@/components/BottomSheet';
import { MAP_LAYERS } from '@/lib/mapLayers';

export default function LayersSheet({ open, onClose, layer, onSelect }) {
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
    </BottomSheet>
  );
}