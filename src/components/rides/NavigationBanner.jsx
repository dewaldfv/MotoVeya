import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation, Fuel, UtensilsCrossed, Beer, Clock, Route as RouteIcon, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LocationSearchInput from './LocationSearchInput';
import { savePendingNavigation } from '@/lib/rideCache';
import { toast } from 'sonner';

const ROUTE_OPTIONS = [
  { key: 'fastest', label: 'Fastest' },
  { key: 'scenic', label: 'Scenic' },
  { key: 'avoid_gravel', label: 'Avoid Gravel' },
];

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('No GPS'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

export default function NavigationBanner() {
  const navigate = useNavigate();
  const [start, setStart] = useState(null);
  const [dest, setDest] = useState(null);
  const [routeOption, setRouteOption] = useState('fastest');
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);

  const computeEstimate = async (origin, destination) => {
    if (!origin || !destination) { setEstimate(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination.lng},${destination.lat}?overview=false`);
      const data = await res.json();
      if (data.routes?.[0]) {
        setEstimate({ distance: data.routes[0].distance, duration: data.routes[0].duration });
      } else setEstimate(null);
    } catch (e) { setEstimate(null); } finally { setLoading(false); }
  };

  const handleDestSelect = async (d) => {
    setDest(d);
    let origin = start ? [start.lat, start.lng] : null;
    if (!origin) {
      try { origin = await getCurrentPosition(); } catch (e) { toast.error('Enable GPS to estimate route'); }
    }
    computeEstimate(origin, d);
  };

  const handleStartSelect = (s) => {
    setStart(s);
    if (dest) computeEstimate([s.lat, s.lng], dest);
  };

  const handleStartNavigation = () => {
    if (!dest) { toast.error('Choose a destination first'); return; }
    savePendingNavigation({ start, dest, routeOption });
    navigate('/');
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1a1a] to-[#121212] p-5 shadow-xl ring-1 ring-white/5">
      <div className="pointer-events-none absolute -right-10 -top-10 opacity-[0.07]">
        <Compass size={180} className="text-primary" />
      </div>

      <div className="relative">
        <div className="mb-1 text-2xl">🧭</div>
        <h2 className="text-xl font-bold text-white">Directions</h2>
        <p className="mt-1 text-sm text-white/50">Plan a ride from Point A to Point B using MotoGo Navigation.</p>

        <div className="mt-4 space-y-2.5">
          <LocationSearchInput placeholder="Search start location (leave empty for current)" value={start?.name} onSelect={handleStartSelect} onClear={() => setStart(null)} />
          <LocationSearchInput placeholder="Search destination" value={dest?.name} onSelect={handleDestSelect} onClear={() => { setDest(null); setEstimate(null); }} />
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Route Options</p>
          <div className="flex gap-2">
            {ROUTE_OPTIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => setRouteOption(o.key)}
                className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${routeOption === o.key ? 'bg-primary text-primary-foreground' : 'bg-white/5 text-white/60'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {(loading || estimate) && (
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="flex items-center gap-1.5 text-white/40"><RouteIcon size={13} /><span className="text-[10px] font-semibold uppercase">Distance</span></div>
              <div className="mt-0.5 text-lg font-black text-white">{loading ? '…' : `${(estimate.distance / 1000).toFixed(0)} km`}</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="flex items-center gap-1.5 text-white/40"><Clock size={13} /><span className="text-[10px] font-semibold uppercase">Ride Time</span></div>
              <div className="mt-0.5 text-lg font-black text-white">{loading ? '…' : `${Math.round(estimate.duration / 60)} min`}</div>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {[{ icon: Fuel, label: 'Fuel Stops' }, { icon: UtensilsCrossed, label: 'Restaurants' }, { icon: Beer, label: 'Pubs' }].map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <Icon size={13} /> {label}
            </span>
          ))}
        </div>

        <Button size="lg" className="mt-5 min-h-[54px] w-full text-base" onClick={handleStartNavigation} disabled={!dest}>
          <Navigation size={18} className="mr-2" /> Start Navigation
        </Button>
      </div>
    </div>
  );
}