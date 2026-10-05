import { Fuel, AlertTriangle, Bike } from 'lucide-react';
import { useBikeRange, haversineKm } from '@/lib/stopSuggestions';

export default function RangeWarning({ waypoints = [], routeData = null }) {
  const { bike, rangeKm, safeRange } = useBikeRange();

  if (waypoints.length < 2 || !bike || !rangeKm) return null;
  const legs = [];
  let totalKm = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const km = Number(routeData?.legs?.[i]?.distance_km) || haversineKm(waypoints[i], waypoints[i + 1]);
    totalKm += km;
    legs.push({ from: waypoints[i].name, to: waypoints[i + 1].name, km, over: km > safeRange });
  }
  const overLegs = legs.filter((l) => l.over);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Bike size={16} className="text-primary" />
        {bike.nickname ? `${bike.nickname} (${bike.make} ${bike.model})` : `${bike.make} ${bike.model}`}
      </div>
      {routeData?.engine === 'osrm' && <p className="mt-1 text-[10px] text-muted-foreground">Fuel planning uses actual road distance.</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Fuel size={12} /> Est. range: {Math.round(rangeKm)} km</span>
        <span>Total route: {Math.round(totalKm)} km</span>
      </div>

      {totalKm > safeRange && (
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>Total distance exceeds 80% of your bike's estimated range. Plan a fuel stop.</span>
        </div>
      )}

      {overLegs.length > 0 && (
        <div className="mt-2 space-y-1">
          {overLegs.map((l, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{l.from} → {l.to}: {Math.round(l.km)} km exceeds safe range ({Math.round(safeRange)} km).</span>
            </div>
          ))}
        </div>
      )}

      {totalKm <= safeRange && overLegs.length === 0 && (
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">Within safe fuel range — no stops required.</p>
      )}
    </div>
  );
}