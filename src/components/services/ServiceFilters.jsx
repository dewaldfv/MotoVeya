import { Check } from 'lucide-react';
import BottomSheet from '@/components/BottomSheet';

const DISTANCE_OPTIONS = [
  { value: null, label: 'Any' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
];

const RATING_OPTIONS = [
  { value: null, label: 'Any' },
  { value: 3, label: '3.0+' },
  { value: 4, label: '4.0+' },
  { value: 4.5, label: '4.5+' },
];

const TOGGLES = [
  { key: 'openNow', label: 'Open Now' },
  { key: 'verified', label: 'Verified Business' },
  { key: 'premiumPartner', label: 'Premium Partner' },
];

export default function ServiceFilters({ open, onClose, filters, onChange }) {
  const toggle = (key) => onChange({ ...filters, [key]: !filters[key] });

  return (
    <BottomSheet open={open} onClose={onClose} title="Filters">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-bold">Distance</p>
          <div className="flex flex-wrap gap-2">
            {DISTANCE_OPTIONS.map((opt) => (
              <button key={opt.label} onClick={() => onChange({ ...filters, distance: opt.value })}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filters.distance === opt.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold">Minimum Rating</p>
          <div className="flex flex-wrap gap-2">
            {RATING_OPTIONS.map((opt) => (
              <button key={opt.label} onClick={() => onChange({ ...filters, rating: opt.value })}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filters.rating === opt.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="mb-1 text-sm font-bold">Only Show</p>
          {TOGGLES.map((opt) => (
            <button key={opt.key} onClick={() => toggle(opt.key)} className="flex w-full items-center justify-between rounded-xl bg-card p-3">
              <span className="text-sm font-medium">{opt.label}</span>
              <div className={`flex h-6 w-6 items-center justify-center rounded-md border-2 ${filters[opt.key] ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
                {filters[opt.key] && <Check size={14} />}
              </div>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="min-h-[48px] w-full rounded-2xl bg-primary font-bold text-primary-foreground">
          Apply Filters
        </button>
      </div>
    </BottomSheet>
  );
}