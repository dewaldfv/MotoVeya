import { Loader2 } from 'lucide-react';

export default function LocationInfoCard({ address, lat, lng, town, road, loading }) {
  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
        <Loader2 size={14} className="animate-spin text-primary" />
        Looking up address &amp; nearby details…
      </div>
    );
  }
  if (lat == null) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Import from Google Maps or tap the map to set the location.
      </p>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-3 text-xs">
      <div className="col-span-2 flex items-start gap-2">
        <span className="text-base leading-none">📍</span>
        <div className="min-w-0">
          <p className="font-semibold text-foreground">Address</p>
          <p className="text-muted-foreground">{address || 'Unavailable'}</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="text-base leading-none">🌍</span>
        <div>
          <p className="font-semibold text-foreground">Coordinates</p>
          <p className="text-muted-foreground">{Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="text-base leading-none">🏙️</span>
        <div>
          <p className="font-semibold text-foreground">Town/City</p>
          <p className="text-muted-foreground">{town || 'Unknown'}</p>
        </div>
      </div>
      <div className="col-span-2 flex items-start gap-2">
        <span className="text-base leading-none">🛣️</span>
        <div className="min-w-0">
          <p className="font-semibold text-foreground">Nearest Road</p>
          <p className="text-muted-foreground">{road || 'Unknown'}</p>
        </div>
      </div>
    </div>
  );
}