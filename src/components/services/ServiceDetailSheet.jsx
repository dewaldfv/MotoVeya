import { useState, useEffect } from 'react';
import { Phone, Globe, MapPin, Navigation, Share2, Heart, Clock } from 'lucide-react';
import BottomSheet from '@/components/BottomSheet';
import { Button } from '@/components/ui/button';
import { getCategoryConfig } from '@/lib/serviceCategories';

export default function ServiceDetailSheet({ service, open, onClose }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!service) return;
    const favs = JSON.parse(localStorage.getItem('service_favorites') || '[]');
    setSaved(favs.includes(service.id));
  }, [service]);

  if (!service) return null;
  const config = getCategoryConfig(service.category);

  const handleCall = () => { window.location.href = `tel:${service.phone}`; };
  const handleNavigate = () => { window.open(`https://www.google.com/maps/dir/?api=1&destination=${service.lat},${service.lng}`, '_blank'); };
  const handleGoogleMaps = () => { window.open(`https://www.google.com/maps/search/?api=1&query=${service.lat},${service.lng}`, '_blank'); };
  const handleWebsite = () => {
    if (!service.website) return;
    const url = service.website.startsWith('http') ? service.website : `https://${service.website}`;
    window.open(url, '_blank');
  };

  const handleShare = async () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${service.lat},${service.lng}`;
    if (navigator.share) {
      try { await navigator.share({ title: service.name, text: `${service.name} - ${config.label}`, url }); } catch {}
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  const toggleFavorite = () => {
    const favs = JSON.parse(localStorage.getItem('service_favorites') || '[]');
    const newFavs = saved ? favs.filter((id) => id !== service.id) : [...favs, service.id];
    localStorage.setItem('service_favorites', JSON.stringify(newFavs));
    setSaved(!saved);
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div
        className="flex h-32 items-center justify-center rounded-2xl text-5xl"
        style={{ background: `linear-gradient(135deg, ${config.color}30, ${config.color}10)` }}
      >
        {config.icon}
      </div>

      <div className="mt-3">
        <h2 className="text-xl font-bold">{service.name}</h2>
        <div className="mt-1 flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: config.color + '20', color: config.color }}
          >
            {config.label}
          </span>
          <span className="text-sm font-medium text-primary">{service.distance}km away</span>
        </div>
      </div>

      <div className="mt-4 space-y-2.5 text-sm">
        {service.address && (
          <p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-muted-foreground" /> {service.address}</p>
        )}
        {service.opening_hours && (
          <p className="flex items-start gap-2"><Clock size={16} className="mt-0.5 shrink-0 text-muted-foreground" /> {service.opening_hours}</p>
        )}
        {service.phone && (
          <p className="flex items-start gap-2"><Phone size={16} className="mt-0.5 shrink-0 text-muted-foreground" /> {service.phone}</p>
        )}
        {service.website && (
          <button onClick={handleWebsite} className="flex items-start gap-2 text-primary">
            <Globe size={16} className="mt-0.5 shrink-0" /> Visit website
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button onClick={handleNavigate} className="min-h-[56px] flex-col gap-1 rounded-2xl">
          <Navigation size={18} /> Navigate
        </Button>
        {service.phone ? (
          <Button onClick={handleCall} variant="secondary" className="min-h-[56px] flex-col gap-1 rounded-2xl">
            <Phone size={18} /> Call
          </Button>
        ) : (
          <Button onClick={handleGoogleMaps} variant="secondary" className="min-h-[56px] flex-col gap-1 rounded-2xl">
            <MapPin size={18} /> Maps
          </Button>
        )}
        <Button onClick={handleShare} variant="secondary" className="min-h-[56px] flex-col gap-1 rounded-2xl">
          <Share2 size={18} /> Share
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button onClick={handleGoogleMaps} variant="outline" className="min-h-[48px] rounded-2xl">
          <MapPin size={16} className="mr-2" /> Google Maps
        </Button>
        <Button onClick={toggleFavorite} variant="outline" className="min-h-[48px] rounded-2xl">
          <Heart size={16} className="mr-2" fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save'}
        </Button>
      </div>
    </BottomSheet>
  );
}