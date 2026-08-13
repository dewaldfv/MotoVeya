import { useQuery } from '@tanstack/react-query';
import { Gauge, Fuel, Wrench, History } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import BottomSheet from '@/components/BottomSheet';

const SERVICE_INTERVAL = 5000;

export default function BikeDetailSheet({ bike, open, onClose }) {
  const { data: refills = [] } = useQuery({
    queryKey: ['bike-refills', bike?.id],
    queryFn: () => base44.entities.FuelRefill.filter({ bike_id: bike.id }, '-refill_date', 200),
    enabled: !!bike?.id && open,
  });
  const { data: services = [] } = useQuery({
    queryKey: ['bike-services', bike?.id],
    queryFn: () => base44.entities.ServiceRecord.filter({ bike_id: bike.id }, '-service_date', 100),
    enabled: !!bike?.id && open,
  });
  const { data: profile } = useQuery({
    queryKey: ['bike-fuel-profile', bike?.id],
    queryFn: async () => (await base44.entities.FuelProfile.filter({ bike_id: bike.id }, '-last_calculated', 1))[0] || null,
    enabled: !!bike?.id && open,
  });

  if (!bike) return null;

  const odometer = refills.reduce((max, r) => Math.max(max, r.odometer_km || 0), 0) || null;
  const consumption = profile?.adaptive_l_per_100km || bike.fuel_consumption_l_per_100km;
  let litresRemaining = null;
  if (profile?.estimated_range_km && consumption) {
    litresRemaining = Math.max(0, Math.round((profile.estimated_range_km * consumption / 100) * 10) / 10);
  } else if (bike.tank_capacity_l) {
    litresRemaining = Math.round(bike.tank_capacity_l * 10) / 10;
  }
  const kmToService = odometer != null ? Math.max(0, SERVICE_INTERVAL - (odometer % SERVICE_INTERVAL)) : null;

  return (
    <BottomSheet open={open} onClose={onClose} title={`${bike.make} ${bike.model}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Stat icon={Gauge} label="Odometer" value={odometer != null ? `${odometer.toLocaleString()} km` : '—'} />
          <Stat icon={Fuel} label="Fuel Remaining" value={litresRemaining != null ? `${litresRemaining} L` : '—'} />
          <Stat icon={Wrench} label="Next Service in" value={kmToService != null ? `${kmToService.toLocaleString()} km` : '—'} />
          <Stat icon={Fuel} label="Tank Capacity" value={bike.tank_capacity_l ? `${bike.tank_capacity_l} L` : '—'} />
        </div>

        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-bold"><History size={16} /> Service History</p>
          {services.length === 0 ? (
            <p className="rounded-2xl bg-secondary p-4 text-center text-sm text-muted-foreground">No service records yet.</p>
          ) : (
            <div className="space-y-2">
              {services.map((s) => (
                <div key={s.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold capitalize">{(s.service_type || '').replace('_', ' ')}</span>
                    <span className="text-xs text-muted-foreground">{s.service_date ? new Date(s.service_date).toLocaleDateString('en-ZA') : ''}</span>
                  </div>
                  {s.workshop_name && <p className="text-xs text-muted-foreground">{s.workshop_name}</p>}
                  <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                    {s.odometer_km != null && <span>{s.odometer_km.toLocaleString()} km</span>}
                    {s.cost_zar != null && <span>R{s.cost_zar}</span>}
                  </div>
                  {s.description && <p className="mt-1 text-xs text-foreground/80">{s.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
      <Icon size={18} className="text-primary" />
      <div>
        <p className="text-base font-black">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}