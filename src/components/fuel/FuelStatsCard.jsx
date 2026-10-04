import { Fuel, Gauge, Coins, Route } from 'lucide-react';

export default function FuelStatsCard({ profile, bike }) {
  if (!profile) {
    return (
      <div className="rounded-2xl bg-card p-6 text-center">
        <Fuel size={32} className="mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No fuel data yet. Log your first refill to start building your adaptive consumption profile.</p>
      </div>
    );
  }

  const confidence = profile.confidence_score || 0;
  const confidenceColor = confidence >= 70 ? 'bg-green-500' : confidence >= 30 ? 'bg-primary' : 'bg-muted-foreground';
  const confidenceLabel = confidence >= 70 ? 'Confident' : confidence >= 30 ? 'Improving' : 'Learning';

  const stats = [
    { icon: Fuel, label: 'Adaptive', value: profile.adaptive_l_per_100km ? profile.adaptive_l_per_100km.toFixed(1) : '—', unit: 'L/100km' },
    { icon: Gauge, label: 'Efficiency', value: profile.km_per_litre ? profile.km_per_litre.toFixed(1) : '—', unit: 'km/L' },
    { icon: Coins, label: 'Cost/km', value: profile.cost_per_km ? `R${profile.cost_per_km.toFixed(2)}` : '—', unit: '' },
    { icon: Route, label: 'Range', value: profile.estimated_range_km || '—', unit: 'km' },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold">{bike?.make} {bike?.model}</h3>
            <p className="text-xs text-muted-foreground">Adaptive Fuel Profile</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-primary">{confidence}%</div>
            <p className="text-xs text-muted-foreground">{confidenceLabel}</p>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div className={`h-full rounded-full transition-all duration-500 ${confidenceColor}`} style={{ width: `${confidence}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {profile.refill_count || 0} refills logged · {(profile.total_distance_km || 0).toFixed(0)}km tracked
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 landscape:grid-cols-4">
        {stats.map(({ icon: Icon, label, value, unit }) => (
          <div key={label} className="rounded-2xl bg-card p-3 text-center">
            <Icon size={18} className="mx-auto mb-1 text-primary" />
            <div className="text-lg font-black">{value}</div>
            {unit && <div className="text-xs text-muted-foreground">{unit}</div>}
            <div className="text-[10px] text-muted-foreground/70">{label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-card p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-sm font-bold">R{(profile.total_fuel_cost || 0).toFixed(0)}</div>
            <div className="text-[10px] text-muted-foreground">Total Cost</div>
          </div>
          <div>
            <div className="text-sm font-bold">{(profile.total_fuel_l || 0).toFixed(0)}L</div>
            <div className="text-[10px] text-muted-foreground">Total Fuel</div>
          </div>
          <div>
            <div className="text-sm font-bold">R{(profile.avg_price_per_litre || 0).toFixed(2)}</div>
            <div className="text-[10px] text-muted-foreground">Avg R/L</div>
          </div>
        </div>
      </div>
    </div>
  );
}