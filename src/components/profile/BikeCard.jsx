import { Pencil, Trash2, Bike as BikeIcon, Fuel, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * Polished motorcycle card for the profile garage view.
 * Renders make, model, year, custom photo, fuel specs, and edit/delete actions.
 */
export default function BikeCard({ bike, onEdit, onDelete, onSetPrimary, avgConsumption }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      {bike.photo_url ? (
        <div className="h-40 w-full overflow-hidden bg-muted">
          <img src={bike.photo_url} alt={`${bike.make} ${bike.model}`} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex h-24 w-full items-center justify-center bg-muted">
          <BikeIcon size={36} className="text-muted-foreground" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-bold">{bike.make} {bike.model}</h3>
              {bike.is_primary && <Badge className="bg-primary text-[10px]">Primary</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{bike.year || '—'} · {bike.engine_size_cc || '?'}cc</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onEdit?.(bike)} aria-label="Edit bike"><Pencil size={16} /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => onDelete?.(bike)} aria-label="Delete bike"><Trash2 size={16} /></Button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-secondary p-2"><Fuel size={12} className="mr-1 inline text-primary" />{bike.tank_capacity_l || '?'}L tank</div>
          <div className="rounded-xl bg-secondary p-2"><Fuel size={12} className="mr-1 inline text-primary" />{bike.fuel_consumption_l_per_100km || avgConsumption || '?'}L/100km</div>
        </div>
        {bike.nickname && <p className="mt-2 text-xs font-medium text-primary">"{bike.nickname}"</p>}
        {!bike.is_primary && onSetPrimary && (
          <button onClick={() => onSetPrimary(bike)} className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary"><Star size={12} /> Set as primary</button>
        )}
      </div>
    </div>
  );
}