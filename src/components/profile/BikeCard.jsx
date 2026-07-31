import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function BikeCard({ bike, onEdit, onDelete }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm hidden">
      <div className="flex items-start justify-between hidden">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-bold">{bike.make} {bike.model}</h3>
            {bike.is_primary && <Badge className="bg-primary text-[10px]">Primary</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{bike.year} · {bike.engine_size_cc || '?'}cc</p>
          {bike.tank_capacity_l &&
          <p className="text-xs text-muted-foreground">
              {bike.tank_capacity_l}L tank · {bike.fuel_consumption_l_per_100km}L/100km
            </p>
          }
          {bike.nickname && <p className="mt-0.5 text-xs font-medium text-primary">"{bike.nickname}"</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onEdit(bike)}>
            <Pencil size={14} />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => onDelete(bike.id)}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </div>);

}