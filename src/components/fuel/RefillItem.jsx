import { Fuel, MapPin, Pencil, Trash2 } from 'lucide-react';
import moment from 'moment';

export default function RefillItem({ refill, onEdit, onDelete }) {
  const date = moment(refill.refill_date).format('DD MMM YYYY');
  const consumption = refill.consumption_l_per_100km;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Fuel size={18} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm">{(refill.litres || 0).toFixed(1)}L</span>
          {refill.total_cost != null && <span className="font-bold text-sm text-primary">R{refill.total_cost.toFixed(2)}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{date}</span>
          {refill.odometer_km != null && <span>· {refill.odometer_km.toLocaleString()}km</span>}
          {!refill.is_full_tank && <span>· Partial</span>}
        </div>
        {(refill.location_name || consumption != null) && (
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground/70">
            {refill.location_name && <span className="flex items-center gap-1"><MapPin size={10} /> {refill.location_name}</span>}
            {consumption != null && <span>· {consumption.toFixed(1)}L/100km</span>}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onEdit && (
          <button
            onClick={onEdit}
            className="glove-target flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground active:scale-95"
            aria-label="Edit refill"
          >
            <Pencil size={16} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="glove-target flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10 text-destructive active:scale-95"
            aria-label="Delete refill"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}