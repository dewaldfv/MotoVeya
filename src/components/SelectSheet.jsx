import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import BottomSheet from '@/components/BottomSheet';

/**
 * Touch-friendly selection menu built on the existing BottomSheet.
 * Replaces native <select> elements with large tap targets and a slide-up sheet.
 *
 * options: [{ value, label, icon? }]
 */
export default function SelectSheet({ value, onChange, options, placeholder = 'Select…', label, triggerClassName = '' }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const display = selected ? selected.label : placeholder;

  const handleSelect = (v) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center justify-between rounded-md border border-input bg-transparent px-3 text-left text-sm glove-target ${triggerClassName}`}
      >
        <span className={`truncate ${selected ? '' : 'text-muted-foreground'}`}>{display}</span>
        <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={label}>
        <div className="space-y-1">
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={String(o.value)}
                type="button"
                onClick={() => handleSelect(o.value)}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left text-base glove-target transition-colors ${active ? 'bg-primary/10 font-semibold text-primary' : 'active:bg-secondary'}`}
              >
                <span className="flex items-center gap-3">
                  {o.icon && <span className="text-xl">{o.icon}</span>}
                  {o.label}
                </span>
                {active && <Check size={18} className="text-primary" />}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}