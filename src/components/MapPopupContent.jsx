import { Navigation, Bookmark, Info } from 'lucide-react';
import { formatEventDateRange } from '@/lib/eventDate';

export default function MapPopupContent({ item, onMoreInfo, onSave, onNavigate }) {
  const title = item.name || item.title || item.rider_name || 'Location';
  const isDistress = item.category === 'distress' || !!item.rider_name;

  return (
    <div className="min-w-[200px] space-y-2 p-1">
      <div>
        <h3 className="text-sm font-bold leading-tight">{title}</h3>
        {item.category && !isDistress && (
          <span className="text-xs capitalize text-muted-foreground">{item.category.replace('_', ' ')}</span>
        )}
        {item.venue_name && <p className="text-xs text-muted-foreground">{item.venue_name}</p>}
        {item.event_date && (
          <p className="text-xs text-muted-foreground">
            {formatEventDateRange(item)}
          </p>
        )}
        {item.address && <p className="text-xs text-muted-foreground">{item.address}</p>}
        {item.description && <p className="line-clamp-2 text-xs">{item.description}</p>}
        {item.entry_fee_zar != null && (
          <p className="text-xs font-medium">{item.entry_fee_zar === 0 ? 'Free entry' : `R${item.entry_fee_zar} entry`}</p>
        )}
        {isDistress && <p className="text-xs font-medium text-destructive">Active distress alert</p>}
      </div>
      <div className="flex gap-1.5 pt-1">
        <button onClick={onMoreInfo} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary/10 px-2 py-2 text-xs font-medium text-primary active:scale-95">
          <Info size={12} /> Info
        </button>
        <button onClick={onSave} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-secondary px-2 py-2 text-xs font-medium active:scale-95">
          <Bookmark size={12} /> Save
        </button>
        <button onClick={onNavigate} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-2 py-2 text-xs font-medium text-primary-foreground active:scale-95">
          <Navigation size={12} /> Go
        </button>
      </div>
    </div>
  );
}