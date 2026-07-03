import { Phone, Navigation, Star, MapPin, Globe, Clock, BadgeCheck, Crown, Heart, Tag } from 'lucide-react';
import BottomSheet from '@/components/BottomSheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getServiceCategory, formatDistance, haversine, isOpenNow } from '@/lib/serviceCategories';

export default function ServiceDetailSheet({ service, userPos, isFavorite, onFavorite, onNavigate, onClose }) {
  if (!service) return null;
  const cat = getServiceCategory(service.category);
  const distance = userPos ? haversine(userPos[0], userPos[1], service.lat, service.lng) : null;
  const open = isOpenNow(service);

  return (
    <BottomSheet open={!!service} onClose={onClose} title={service.name}>
      <div className="space-y-4">
        {service.photo_urls?.[0]
          ? <img src={service.photo_urls[0]} alt={service.name} className="h-44 w-full rounded-2xl object-cover" />
          : service.logo_url
            ? <img src={service.logo_url} alt={service.name} className="h-44 w-full rounded-2xl object-cover" />
            : <div className="flex h-44 items-center justify-center rounded-2xl text-6xl" style={{ backgroundColor: cat.color + '20' }}>{cat.emoji}</div>}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{cat.emoji} {cat.label}</Badge>
          {service.is_verified && <Badge className="bg-blue-600"><BadgeCheck size={12} className="mr-1" /> Verified</Badge>}
          {service.is_premium_partner && <Badge className="bg-primary"><Crown size={12} className="mr-1" /> Premium Partner</Badge>}
          {service.is_featured && <Badge className="bg-yellow-500 text-black">Featured</Badge>}
        </div>

        {service.description && <p className="text-sm text-muted-foreground">{service.description}</p>}

        <div className="flex flex-wrap items-center gap-4">
          {service.rating != null && (
            <div className="flex items-center gap-1">
              <Star size={18} className="fill-yellow-500 text-yellow-500" />
              <span className="font-bold">{service.rating.toFixed(1)}</span>
              {service.review_count != null && <span className="text-xs text-muted-foreground">({service.review_count})</span>}
            </div>
          )}
          {distance != null && <span className="text-sm text-muted-foreground">{formatDistance(distance)} away</span>}
          <span className={`text-sm font-semibold ${open ? 'text-green-600' : 'text-red-500'}`}>{open ? 'Open Now' : 'Closed'}</span>
        </div>

        {service.has_premium_discount && (
          <div className="flex items-center gap-2 rounded-2xl bg-primary/10 p-3">
            <Tag size={18} className="shrink-0 text-primary" />
            <div>
              <p className="text-sm font-bold text-primary">Premium Member Discount</p>
              {service.premium_discount_description && <p className="text-xs text-muted-foreground">{service.premium_discount_description}</p>}
            </div>
          </div>
        )}

        <div className="space-y-2 text-sm">
          {service.address && <div className="flex items-start gap-2 text-muted-foreground"><MapPin size={16} className="mt-0.5 shrink-0" /> {service.address}</div>}
          {service.town && <div className="flex items-center gap-2 text-muted-foreground"><MapPin size={16} /> {service.town}{service.province ? `, ${service.province}` : ''}</div>}
          {service.phone && <a href={`tel:${service.phone}`} className="flex items-center gap-2 text-muted-foreground"><Phone size={16} /> {service.phone}</a>}
          {service.website && <a href={service.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary"><Globe size={16} /> Visit website</a>}
          {service.opening_hours && <div className="flex items-center gap-2 text-muted-foreground"><Clock size={16} /> {service.opening_hours}</div>}
        </div>

        {service.photo_urls?.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {service.photo_urls.slice(1).map((url, i) => (
              <img key={i} src={url} alt={`${service.name} ${i + 2}`} className="h-24 w-24 shrink-0 rounded-xl object-cover" />
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {service.phone && (
            <Button size="lg" variant="secondary" className="min-h-[56px] flex-1" onClick={() => window.open(`tel:${service.phone}`)}>
              <Phone size={18} className="mr-2" /> Call
            </Button>
          )}
          <Button size="lg" className="min-h-[56px] flex-1" onClick={() => onNavigate(service)}>
            <Navigation size={18} className="mr-2" /> Navigate
          </Button>
          {onFavorite && (
            <Button size="lg" variant="outline" className="min-h-[56px] px-4" onClick={() => onFavorite(service)}>
              <Heart size={18} className={isFavorite ? 'fill-primary text-primary' : ''} />
            </Button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}