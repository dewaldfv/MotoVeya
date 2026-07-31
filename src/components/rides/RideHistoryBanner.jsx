import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Route, Clock, Gauge, Fuel, TrendingUp, History } from 'lucide-react';

function fmtDuration(mins) {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function RideHistoryBanner({ stats, lastRideDate }) {
  const navigate = useNavigate();
  const items = [
    { icon: Route, label: 'Rides', value: `${stats.totalRides}` },
    { icon: TrendingUp, label: 'Distance', value: `${stats.totalKm.toFixed(0)} km` },
    { icon: Clock, label: 'Ride Time', value: fmtDuration(stats.totalMinutes) },
    { icon: Gauge, label: 'Avg Speed', value: `${stats.avgSpeed.toFixed(0)} km/h` },
    { icon: Fuel, label: 'Fuel Used', value: `${stats.totalFuel.toFixed(1)} L` },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1a1a] to-[#121212] p-5 shadow-xl ring-1 ring-white/5">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-end opacity-[0.05]">
        <span className="text-[10rem] leading-none">🏍</span>
      </div>

      <div className="relative">
        <h2 className="text-xl font-bold text-white">🏍 Ride History</h2>
        <p className="mt-1 text-sm text-white/50">View your previous rides and riding statistics.</p>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {items.map((s) => (
            <div key={s.label} className="rounded-2xl bg-white/5 p-3">
              <s.icon size={15} className="text-primary" />
              <div className="mt-1 text-base font-black text-white">{s.value}</div>
              <div className="text-[10px] uppercase text-white/40">{s.label}</div>
            </div>
          ))}
        </div>

        {lastRideDate && (
          <p className="mt-3 text-xs text-white/40">Last ride: {lastRideDate}</p>
        )}

        <Button
          size="lg"
          variant="secondary"
          className="mt-4 min-h-[50px] w-full bg-white/10 text-white hover:bg-white/15"
          onClick={() => navigate('/rides/history')}
        >
          <History size={18} className="mr-2" /> View Ride History
        </Button>
      </div>
    </div>
  );
}