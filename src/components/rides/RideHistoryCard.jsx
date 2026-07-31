import { Link } from 'react-router-dom';
import { Clock, Gauge, Fuel } from 'lucide-react';

function RoutePreview({ polyline }) {
  let pts = [];
  try { pts = polyline ? JSON.parse(polyline) : []; } catch { pts = []; }
  if (pts.length < 2) {
    return <div className="flex h-full w-full items-center justify-center bg-secondary text-muted-foreground"><span className="text-xs">No route</span></div>;
  }
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const w = 160, h = 100, pad = 10;
  const sx = (maxLng - minLng) || 1;
  const sy = (maxLat - minLat) || 1;
  const proj = (pt) => {
    const x = pad + ((pt[1] - minLng) / sx) * (w - 2 * pad);
    const y = pad + ((maxLat - pt[0]) / sy) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };
  const d = pts.map(proj).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
      <polyline points={d} fill="none" stroke="hsl(26 100% 50%)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function RideHistoryCard({ ride }) {
  const date = new Date(ride.ride_date || ride.created_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <Link to={`/rides/${ride.id}`} className="block overflow-hidden rounded-3xl bg-card shadow-md ring-1 ring-border transition-transform active:scale-[0.99]">
      <div className="flex">
        <div className="h-24 w-28 shrink-0 bg-secondary">
          <RoutePreview polyline={ride.route_polyline} />
        </div>
        <div className="flex-1 p-3">
          <h3 className="truncate font-bold">{ride.title || 'Untitled Ride'}</h3>
          <p className="text-xs text-muted-foreground">{date}</p>
          <div className="mt-1 text-lg font-black text-primary">
            {ride.distance_km?.toFixed(1) || '0'}<span className="text-xs font-normal text-muted-foreground"> km</span>
          </div>
        </div>
      </div>
      <div className="flex gap-3 border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Clock size={12} /> {ride.duration_minutes || 0}m</span>
        <span className="flex items-center gap-1"><Gauge size={12} /> {ride.average_speed_kmh?.toFixed(0) || 0}km/h</span>
        {ride.fuel_consumed_l != null && <span className="flex items-center gap-1"><Fuel size={12} /> {ride.fuel_consumed_l.toFixed(1)}L</span>}
      </div>
    </Link>
  );
}