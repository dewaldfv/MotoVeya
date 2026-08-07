import { Phone, Navigation, Star, MapPin, Heart } from 'lucide-react';
import { getServiceCategory, formatDistance, haversine, isOpenNow } from '@/lib/serviceCategories';

export default function ServiceListingCard({ service, userPos, isFavorite, onFavorite, onSelect, onNavigate }) {
  const cat = getServiceCategory(service.category);
  const distance = userPos ? haversine(userPos[0], userPos[1], service.lat, service.lng) : null;
  const open = isOpenNow(service);

  return (
    <div className="rounded-2xl bg-card p-3 shadow-sm active:scale-[0.99] transition-transform" onClick={() => onSelect(service)}>
      <div className="flex gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl" style={{ backgroundColor: cat.color + '20' }}>
          {service.logo_url || service.photo_urls?.[0]
            ? <img src={service.logo_url || service.photo_urls[0]} alt={service.name} className="h-full w-full object-cover" />
            : <span className="text-2xl">{cat.emoji}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-bold">{service.name}</h3>
            <button onClick={(e) => { e.stopPropagation(); onFavorite(service); }} className="shrink-0">
              <Heart size={18} className={isFavorite ? 'fill-primary text-primary' : 'text-muted-foreground'} />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{cat.label}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {service.rating != null && (
              <span className="flex items-center gap-0.5 font-medium">
                <Star size={12} className="fill-yellow-500 text-yellow-500" /> {service.rating.toFixed(1)}
              </span>
            )}
            {distance != null && <span className="text-muted-foreground">{formatDistance(distance)}</span>}
            <span className={`font-medium ${open ? 'text-green-600' : 'text-red-500'}`}>{open ? 'Open' : 'Closed'}</span>
            {service.is_verified && <span className="text-blue-600 font-medium">✓ Verified</span>}
          </div>
          {service.town && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={12} /> <span className="truncate">{service.town}</span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        {service.phone && (
          <button onClick={(e) => { e.stopPropagation(); window.open(`tel:${service.phone}`); }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-secondary py-2 text-sm font-semibold">
            <Phone size={14} /> Call
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onNavigate(service); }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground">
          <Navigation size={14} /> Navigate
        </button>
      </div>
    </div>
  );
}