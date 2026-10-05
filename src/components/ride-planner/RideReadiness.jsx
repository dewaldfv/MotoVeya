import { CheckCircle2, AlertTriangle, Route, Fuel, Clock3 } from 'lucide-react';
import { useBikeRange } from '@/lib/stopSuggestions';

export default function RideReadiness({ waypoints = [], routeData = null, routeLoading = false, suggestedStops = [] }) {
  const { rangeKm, safeRange } = useBikeRange();
  if (waypoints.length < 2) return null;
  const routeReady = !!routeData && !routeLoading;
  const distanceKm = Number(routeData?.distance_km) || 0;
  const durationMinutes = Number(routeData?.duration_minutes) || 0;
  const fuelWarning = !!rangeKm && distanceKm > safeRange;
  const legFuelWarning = !!rangeKm && (routeData?.legs || []).some((leg) => Number(leg.distance_km) > safeRange);
  const ready = routeReady && !legFuelWarning;

  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">Ride readiness</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{ready ? 'Route is ready to launch.' : 'Check the items below before riding.'}</p>
        </div>
        {ready ? <CheckCircle2 size={22} className="text-emerald-500" /> : <AlertTriangle size={22} className="text-amber-500" />}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-secondary p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Route size={13} /> Route</div>
          <p className="mt-1 text-sm font-semibold">{routeReady ? `${distanceKm.toFixed(1)} km` : 'Calculating…'}</p>
        </div>
        <div className="rounded-2xl bg-secondary p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 size={13} /> Riding time</div>
          <p className="mt-1 text-sm font-semibold">{routeReady ? `${Math.floor(durationMinutes / 60)}h ${Math.round(durationMinutes % 60)}m` : 'Calculating…'}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2 text-xs">
        <div className="flex items-center gap-2">{routeReady ? <CheckCircle2 size={14} className="text-emerald-500" /> : <AlertTriangle size={14} className="text-amber-500" />}<span>{routeReady ? 'Road route calculated' : 'Waiting for road route'}</span></div>
        <div className="flex items-center gap-2">
          {rangeKm ? (legFuelWarning ? <AlertTriangle size={14} className="text-destructive" /> : <CheckCircle2 size={14} className="text-emerald-500" />) : <Fuel size={14} className="text-muted-foreground" />}
          <span>{rangeKm ? (legFuelWarning ? 'At least one route leg exceeds your safe fuel range' : fuelWarning ? 'Fuel stop recommended' : 'Fuel range is sufficient') : 'Bike fuel range not available'}</span>
        </div>
        <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /><span>{suggestedStops.length ? `${suggestedStops.length} recommended stop point${suggestedStops.length === 1 ? '' : 's'} available` : 'No automatic stop points required'}</span></div>
      </div>
    </div>
  );
}
