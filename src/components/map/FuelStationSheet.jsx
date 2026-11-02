import { Navigation, MapPin, Phone, Clock } from 'lucide-react';
import BottomSheet from '@/components/BottomSheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { resolveFuelBrand } from '@/lib/fuelBrandLogos';

export default function FuelStationSheet({ station, onClose, onNavigate }) {
  const brand = station ? resolveFuelBrand(station) : null;
  const brandLabel = brand?.label || station?.brand || null;

  return (
    <BottomSheet open={!!station} onClose={onClose} title={station?.name || 'Fuel Station'}>
      {station && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {brand?.url ? (
              <img
                src={brand.url}
                alt={brandLabel || 'Fuel brand'}
                className="h-14 w-14 shrink-0 rounded-xl border border-white/20 bg-black object-contain p-1"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-green-600 text-2xl">⛽</span>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-bold">{station.name || 'Fuel Station'}</p>
              {brandLabel && <p className="truncate text-sm text-white/60">{brandLabel}</p>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {station.is_open_24h && (
              <Badge className="bg-green-600">
                <Clock size={12} className="mr-1" /> 24h
              </Badge>
            )}
            {station.opening_hours && !station.is_open_24h && (
              <Badge variant="secondary">
                <Clock size={12} className="mr-1" /> {station.opening_hours}
              </Badge>
            )}
            {(station.fuel_types || []).map((type) => (
              <Badge key={type} variant="outline" className="uppercase">{type}</Badge>
            ))}
          </div>

          <div className="space-y-2 text-sm">
            {(station.address || station.town) && (
              <div className="flex items-start gap-2 text-white/75">
                <MapPin size={16} className="mt-0.5 shrink-0" />
                <span>{station.address || station.town}</span>
              </div>
            )}
            {station.phone && (
              <div className="flex items-center gap-2 text-white/75">
                <Phone size={16} /> {station.phone}
              </div>
            )}
          </div>

          <Button size="lg" className="min-h-[56px] w-full text-base" onClick={() => onNavigate?.(station)}>
            <Navigation size={18} className="mr-2" /> Navigate Here
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}