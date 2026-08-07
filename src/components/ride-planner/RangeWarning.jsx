import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Fuel, AlertTriangle, Bike } from 'lucide-react';

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export default function RangeWarning({ waypoints = [] }) {
  const { data: bike } = useQuery({
    queryKey: ['primary-bike'],
    queryFn: async () => {
      const list = await base44.entities.Bike.filter({ is_primary: true }, '-created_date', 1);
      if (list && list.length) return list[0];
      const all = await base44.entities.Bike.list('-created_date', 1);
      return all && all.length ? all[0] : null;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ['fuel-profile', bike?.id],
    enabled: !!bike?.id,
    queryFn: async () => {
      const list = await base44.entities.FuelProfile.filter({ bike_id: bike.id }, '-last_calculated', 1);
      return list && list.length ? list[0] : null;
    },
  });

  if (waypoints.length < 2 || !bike) return null;

  // Estimate range: prefer FuelProfile.estimated_range_km, else compute from tank + consumption.
  let rangeKm = profile?.estimated_range_km;
  if (!rangeKm && bike.tank_capacity_l && bike.fuel_consumption_l_per_100km) {
    rangeKm = (bike.tank_capacity_l / bike.fuel_consumption_l_per_100km) * 100;
  }
  if (!rangeKm) return null;

  const safeRange = rangeKm * 0.8;
  const legs = [];
  let totalKm = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const km = haversineKm(waypoints[i], waypoints[i + 1]);
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