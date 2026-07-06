import { useEffect, useState } from 'react';
import { MapPin, Globe, Building2, Route as Road, Loader2 } from 'lucide-react';

export default function LocationInfoCard({ value, importInfo }) {
  const [geo, setGeo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!value) { setGeo(null); return; }
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${value.lat}&lon=${value.lng}&format=json&zoom=18&addressdetails=1`,
          { headers: { 'User-Agent': 'MotoGo-App/1.0' } }
        );
        const data = await res.json();
        setGeo(data);
      } catch (e) { /* keep last known */ }
      finally { setLoading(false); }
    }, 450);
    return () => clearTimeout(id);
  }, [value?.lat, value?.lng]);

  if (!value) return null;

  const a = geo?.address || {};
  const address = importInfo?.address || geo?.display_name || 'Determining address…';
  const town = a.city || a.town || a.village || a.suburb || a.hamlet || a.county || '—';
  const road = a.road || a.pedestrian || a.footway || a.path || a.neighbourhood || '—';
  const placeName = importInfo?.name;

  return (
    <div className="mt-2 rounded-xl border border-border bg-card p-3 text-xs">
      {placeName && (
        <div className="mb-2 flex items-center gap-2 border-b border-border pb-2">
          <MapPin size={14} className="shrink-0 text-primary" />
          <span className="font-bold text-foreground">{placeName}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="col-span-2 flex items-start gap-2">
          <MapPin size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Address</div>
            <div className="font-medium leading-snug">{address}</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Globe size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Coordinates</div>
            <div className="font-mono font-medium">{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Building2 size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Town / City</div>
            <div className="font-medium leading-snug">{town}</div>
          </div>
        </div>
        <div className="col-span-2 flex items-start gap-2">
          <Road size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Nearest Road</div>
            <div className="font-medium leading-snug">{road}</div>
          </div>
        </div>
      </div>
      {loading && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Loader2 size={11} className="animate-spin" /> Looking up details…
        </div>
      )}
    </div>
  );
}