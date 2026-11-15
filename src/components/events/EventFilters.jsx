import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

export const DATE_PRESETS = [
  { id: 'all', label: 'All dates' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
];

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Matches an event against the selected date preset.
 * Upcoming looks forward from today, past looks back from today, so the presets
 * mean the same thing on both tabs.
 */
export function matchesDatePreset(eventDate, preset, direction = 'upcoming') {
  if (preset === 'all') return true;
  if (!eventDate) return false;

  const today = startOfDay(new Date());
  const dayMs = 24 * 60 * 60 * 1000;
  const eventDay = startOfDay(eventDate);
  const days = preset === 'today' ? 0 : preset === 'week' ? 7 : 30;

  if (preset === 'today') return eventDay.getTime() === today.getTime();

  if (direction === 'past') {
    const from = new Date(today.getTime() - days * dayMs);
    return eventDay >= from && eventDay < today;
  }

  const to = new Date(today.getTime() + days * dayMs);
  return eventDay >= today && eventDay <= to;
}

/** Matches an event's name, venue/location, or description. */
export function matchesEventSearch(ev, query) {
  const term = (query || '').trim().toLowerCase();
  if (!term) return true;
  return [ev?.title, ev?.venue_name, ev?.description, ev?.town, ev?.province]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(term));
}

export default function EventFilters({ search, onSearchChange, datePreset, onDatePresetChange }) {
  return (
    <div className="mb-3 space-y-2">
      <div className="relative">
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search events, places or details"
          className="h-12 rounded-2xl bg-card pl-11 pr-11"
          type="search"
          enterKeyHint="search"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-muted-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onDatePresetChange(preset.id)}
            className={`min-h-[40px] whitespace-nowrap rounded-full px-4 text-xs font-bold transition-colors ${
              datePreset === preset.id ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}