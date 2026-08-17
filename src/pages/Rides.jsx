import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CloudSun, ChevronRight, Route, Gauge, Fuel, Bike as BikeIcon, Wrench } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import NavigationBanner from '@/components/rides/NavigationBanner';
import RideHistoryBanner from '@/components/rides/RideHistoryBanner';
import RideSummaryCard from '@/components/profile/RideSummaryCard';
import RidesEventsCard from '@/components/rides/RidesEventsCard';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Rides() {
  const navigate = useNavigate();
  const { data: rides = [] } = useQuery({
    queryKey: ['rides'],
    queryFn: async () => {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) return [];
      return (await base44.entities.Ride.filter({ status: 'completed' }, '-ride_date', 100)) || [];
    }
  });

  const { data: bikes = [] } = useQuery({
    queryKey: ['rides-bikes'],
    queryFn: async () => {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) return [];
      return (await base44.entities.Bike.filter({}, '-created_date', 20)) || [];
    }
  });

  const { data: fuelProfiles = [] } = useQuery({
    queryKey: ['rides-fuel-profiles'],
    queryFn: async () => {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) return [];
      return (await base44.entities.FuelProfile.filter({}, '-last_calculated', 10)) || [];
    }
  });

  const stats = useMemo(() => {
    const totalRides = rides.length;
    const totalKm = rides.reduce((s, r) => s + (r.distance_km || 0), 0);
    const totalMinutes = rides.reduce((s, r) => s + (r.duration_minutes || 0), 0);
    const totalFuel = rides.reduce((s, r) => s + (r.fuel_consumed_l || 0), 0);
    const avgSpeed = totalMinutes > 0 ? totalKm / (totalMinutes / 60) : 0;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthDistance = Math.round(rides.filter((r) => new Date(r.ride_date) >= monthStart).reduce((s, r) => s + (r.distance_km || 0), 0));
    const avgRideLength = totalRides > 0 ? Math.round(totalKm / totalRides) : 0;
    const fuelEconomy = fuelProfiles[0]?.adaptive_l_per_100km || fuelProfiles[0]?.baseline_l_per_100km || bikes[0]?.fuel_consumption_l_per_100km || '—';
    const rideTime = totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m`;

    const dayCounts = {};
    rides.forEach((r) => {if (r.ride_date) {const d = DAYS[new Date(r.ride_date).getDay()];dayCounts[d] = (dayCounts[d] || 0) + 1;}});
    const favDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    const profile = fuelProfiles[0];
    const primaryBike = bikes.find((b) => b.is_primary) || bikes[0];
    let litresRemaining = null;
    if (profile?.estimated_range_km && profile?.adaptive_l_per_100km) {
      litresRemaining = Math.max(0, Math.round(profile.estimated_range_km * profile.adaptive_l_per_100km / 100 * 10) / 10);
    } else if (primaryBike?.tank_capacity_l) {
      litresRemaining = Math.round(primaryBike.tank_capacity_l * 10) / 10;
    }
    return { totalRides, totalKm, totalMinutes, totalFuel, avgSpeed, monthDistance, avgRideLength, fuelEconomy, rideTime, favDay, litresRemaining };
  }, [rides, bikes, fuelProfiles]);

  const lastRide = rides[0];
  const lastRideDate = lastRide ?
  new Date(lastRide.ride_date || lastRide.created_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) :
  null;

  return (
    <div className="min-h-screen bg-[#121212] pb-24" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
      <h1 className="px-5 pb-2 pt-2 text-2xl font-bold text-white">Rides</h1>
      <div className="space-y-4 px-4">
        <button
          onClick={() => navigate('/ride-planner')}
          className="flex w-full items-center gap-3 rounded-3xl bg-gradient-to-r from-primary to-orange-600 p-4 text-left shadow-lg active:scale-[0.99] transition-transform">
          
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
          className="flex w-full items-center gap-3 rounded-3xl border border-border bg-card p-4 text-left shadow-sm active:scale-[0.99] transition-transform">
          
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <Route size={24} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-foreground">Saved Routes</p>
            <p className="text-xs text-muted-foreground">Load, share, or delete your planned routes</p>
          </div>
          <ChevronRight className="text-muted-foreground" size={20} />
        </button>
        <button
          onClick={() => navigate('/fuel-tracker')}
          className="flex w-full items-center gap-3 rounded-3xl border border-border bg-card p-4 text-left shadow-sm active:scale-[0.99] transition-transform">
          
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <Fuel size={24} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-foreground">Fuel Tracker</p>
            <p className="text-xs text-muted-foreground">Adaptive consumption and refill history</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-primary">{stats.litresRemaining != null ? `${stats.litresRemaining} L` : '—'}</p>
            <p className="text-[10px] text-muted-foreground">remaining</p>
          </div>
          <ChevronRight className="text-muted-foreground" size={20} />
        </button>
        <button
          onClick={() => navigate('/bike-garage')}
          className="flex w-full items-center gap-3 rounded-3xl border border-border bg-card p-4 text-left shadow-sm active:scale-[0.99] transition-transform">
          
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <BikeIcon size={24} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-foreground">Bike Garage</p>
            <p className="text-xs text-muted-foreground">Manage your motorcycles, fuel data and photos</p>
          </div>
          <ChevronRight className="text-muted-foreground" size={20} />
          </button>

          <RidesEventsCard />







        
        <NavigationBanner />
        <RideHistoryBanner stats={stats} lastRideDate={lastRideDate} />
        <RideSummaryCard
          data={{
            monthDistance: stats.monthDistance,
            avgRideLength: stats.avgRideLength,
            fuelEconomy: stats.fuelEconomy,
            rideTime: stats.rideTime,
            favDay: stats.favDay,
            weatherPref: 'Clear skies'
          }}
          delay={0.2} />
        <button
          onClick={() => navigate('/safety-dashboard')}
          className="flex w-full items-center gap-3 rounded-3xl border border-border bg-card p-4 text-left shadow-sm active:scale-[0.99] transition-transform">
          
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <Gauge size={24} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-foreground">Safety Dashboard</p>
            <p className="text-xs text-muted-foreground">Your riding safety stats and alert history</p>
          </div>
          <ChevronRight className="text-muted-foreground" size={20} />
        </button>
      </div>
    </div>);

}