import { Navigation, Bookmark, Info, Phone, Globe, Clock3, Star, MapPin } from 'lucide-react';
import { formatEventDateRange } from '@/lib/eventDate';
import { getEventMarkerUrl } from '@/lib/eventMarkers';

export default function MapPopupContent({ item, onMoreInfo, onSave, onNavigate }) {
  const title = item.name || item.title || item.rider_name || 'Location';
  const isDistress = item.category === 'distress' || !!item.rider_name;
  const isEvent = !!item.event_date || !!item.venue_name;
  const isPoi = !isEvent && !isDistress && (!!item.address || !!item.phone || !!item.website || !!item.opening_hours || !!item.brand || !!item.source);
  const markerLogoUrl = isEvent ? (item.markerIcon || getEventMarkerUrl(item.category)) : null;
  const phone = item.phone || item.contact_phone;
  const website = item.website || item.url;
  const openingHours = item.opening_hours || item.hours;
  const rating = item.rating ?? item.stars;
  const sourceLabel = item.source === 'openstreetmap' || item.source === 'osm' ? 'OpenStreetMap' : item.source;
  const mapsSearchUrl = item.lat != null && item.lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.lat},${item.lng}`)}`
    : null;

  return (
    <div className="relative min-w-[220px] overflow-hidden rounded-xl bg-card">
      {markerLogoUrl && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-25"
          style={{ backgroundImage: `url(${markerLogoUrl})` }}
        />
      )}
      <div className="relative z-10 space-y-2 p-2">
        <div>
          <h3 className="text-sm font-bold leading-tight drop-shadow-sm">{title}</h3>
          {item.category && !isDistress && (
            <span className="text-xs capitalize text-muted-foreground">{item.category.replace('_', ' ')}</span>
          )}
          {item.venue_name && <p className="text-xs text-muted-foreground">{item.venue_name}</p>}
          {item.event_date && (
            <p className="text-xs text-muted-foreground">
              {formatEventDateRange(item)}
            </p>
          )}
          {item.address && <p className="flex items-start gap-1 text-xs text-muted-foreground"><MapPin size={12} className="mt-0.5 shrink-0" />{item.address}</p>}
          {item.brand && item.brand !== title && <p className="text-xs font-medium text-muted-foreground">{item.brand}</p>}
          {item.description && <p className="line-clamp-2 text-xs">{item.description}</p>}
          {isPoi && (
            <div className="space-y-1 border-t pt-1">
              {rating != null && <p className="flex items-center gap-1 text-xs"><Star size={12} /> {rating}</p>}
              {openingHours && <p className="flex items-start gap-1 text-xs text-muted-foreground"><Clock3 size={12} className="mt-0.5 shrink-0" />{openingHours}</p>}
              {phone && <a href={`tel:${phone}`} className="flex items-center gap-1 text-xs text-primary"><Phone size={12} />{phone}</a>}
              {website && <a href={website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary"><Globe size={12} />Website</a>}
              {sourceLabel && <p className="text-[10px] text-muted-foreground">Source: {sourceLabel}</p>}
            </div>
          )}
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
    </div>
  );
}