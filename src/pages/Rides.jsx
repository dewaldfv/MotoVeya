import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import NavigationBanner from '@/components/rides/NavigationBanner';
import RideHistoryBanner from '@/components/rides/RideHistoryBanner';

export default function Rides() {
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
        <NavigationBanner />
        <RideHistoryBanner stats={stats} lastRideDate={lastRideDate} />
      </div>
    </div>
  );
}