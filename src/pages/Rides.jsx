import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CloudSun, ChevronRight, Route } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import NavigationBanner from '@/components/rides/NavigationBanner';
import RideHistoryBanner from '@/components/rides/RideHistoryBanner';

export default function Rides() {
  const navigate = useNavigate();
  const { data: rides = [] } = useQuery({
    queryKey: ['rides'],
    queryFn: async () => {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) return [];
      return (await base44.entities.Ride.filter({ status: 'completed' }, '-ride_date', 100)) || [];
    },
  });

  const stats = useMemo(() => {
    const totalRides = rides.length;
    const totalKm = rides.reduce((s, r) => s + (r.distance_km || 0), 0);
    const totalMinutes = rides.reduce((s, r) => s + (r.duration_minutes || 0), 0);
    const totalFuel = rides.reduce((s, r) => s + (r.fuel_consumed_l || 0), 0);
    const avgSpeed = totalMinutes > 0 ? totalKm / (totalMinutes / 60) : 0;
    return { totalRides, totalKm, totalMinutes, totalFuel, avgSpeed };
  }, [rides]);

  const lastRide = rides[0];
  const lastRideDate = lastRide
    ? new Date(lastRide.ride_date || lastRide.created_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-[#121212] pb-24" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
      <h1 className="px-5 pb-2 pt-2 text-2xl font-bold text-white">Rides</h1>
      <div className="space-y-4 px-4">
        <button
          onClick={() => navigate('/ride-planner')}
          className="flex w-full items-center gap-3 rounded-3xl bg-gradient-to-r from-primary to-orange-600 p-4 text-left shadow-lg active:scale-[0.99] transition-transform"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
            <CloudSun size={26} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-white">Plan Ride</p>
            <p className="text-xs text-white/80">Build a route with weather & fuel-range checks</p>
          </div>
          <ChevronRight className="text-white/80" size={20} />
        </button>
        <button
          onClick={() => navigate('/rides/saved')}
          className="flex w-full items-center gap-3 rounded-3xl border border-border bg-card p-4 text-left shadow-sm active:scale-[0.99] transition-transform"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <Route size={24} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-foreground">Saved Routes</p>
            <p className="text-xs text-muted-foreground">Load, share, or delete your planned routes</p>
          </div>
          <ChevronRight className="text-muted-foreground" size={20} />
        </button>
        <NavigationBanner />
        <RideHistoryBanner stats={stats} lastRideDate={lastRideDate} />
      </div>
    </div>
  );
}