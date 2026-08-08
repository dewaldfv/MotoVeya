import { Fuel, UtensilsCrossed, Beer, Bike, Wrench, Bed, Hospital, Banknote, Mountain, Siren, LayoutGrid } from 'lucide-react';
import BottomSheet from '@/components/BottomSheet';

export const MAP_CATEGORIES = [
  { key: 'all', label: 'All Places', icon: LayoutGrid },
  { key: 'fuel', label: 'Fuel', icon: Fuel },
  { key: 'food', label: 'Food', icon: UtensilsCrossed },
  { key: 'pub', label: 'Pubs', icon: Beer },
  { key: 'dealership', label: 'Dealers', icon: Bike },
  { key: 'workshop', label: 'Mechanics', icon: Wrench },
  { key: 'accommodation', label: 'Accommodation', icon: Bed },
  { key: 'hospital', label: 'Hospitals', icon: Hospital },
  { key: 'atm', label: 'ATMs', icon: Banknote },
  { key: 'scenic', label: 'Scenic Routes', icon: Mountain },
  { key: 'distress', label: 'Rider in Distress', icon: Siren },
];

export default function CategoryMenu({ open, onClose, activeCat, onSelect }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Map Categories">
      <div className="grid grid-cols-3 gap-3">
        {MAP_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCat === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => { onSelect(cat.key); onClose(); }}
              className={`flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl p-3 transition-colors active:scale-95 ${
                isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              <Icon size={24} />
              <span className="text-center text-xs font-semibold leading-tight">{cat.label}</span>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}