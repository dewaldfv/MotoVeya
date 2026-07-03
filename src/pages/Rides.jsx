import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Route, Clock, Gauge, Fuel, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import LoginPrompt from '@/components/LoginPrompt';
import PullToRefresh from '@/components/PullToRefresh';

function RideCard({ ride }) {
  const date = new Date(ride.ride_date || ride.created_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  return (
    <Link to={`/rides/${ride.id}`} className="block rounded-2xl bg-card p-4 transition-colors active:bg-secondary">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-bold">{ride.title || 'Untitled Ride'}</h3>
          <p className="text-sm text-muted-foreground">{date}</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-black text-primary">{ride.distance_km?.toFixed(1) || '0'}</div>
          <div className="text-[10px] uppercase text-muted-foreground">km</div>
        </div>
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Clock size={14} /> {ride.duration_minutes || 0} min</span>
        <span className="flex items-center gap-1"><Gauge size={14} /> {ride.average_speed_kmh?.toFixed(0) || 0} km/h</span>
        {ride.fuel_consumed_l && <span className="flex items-center gap-1"><Fuel size={14} /> {ride.fuel_consumed_l.toFixed(1)}L</span>}
      </div>
    </Link>
  );
}

export default function Rides() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['rides'],
    queryFn: async () => {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) return null;
      const me = await base44.auth.me();
      const rides = await base44.entities.Ride.filter({ status: 'completed' }, '-ride_date', 50);
      return { user: me, rides: rides || [] };
    },
  });

  const user = data?.user ?? null;
  const rides = data?.rides ?? [];

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['rides'] });
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;
  if (!user) return <LoginPrompt message="Log in to view your ride history" />;

  const totalKm = rides.reduce((s, r) => s + (r.distance_km || 0), 0);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-background p-4 pb-24" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <h1 className="mb-4 text-2xl font-bold">My Rides</h1>
        {rides.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground"><Route size={16} /><span className="text-xs font-semibold uppercase">Total Rides</span></div>
              <div className="mt-1 text-2xl font-black">{rides.length}</div>
            </div>
            <div className="rounded-2xl bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground"><TrendingUp size={16} /><span className="text-xs font-semibold uppercase">Total KM</span></div>
              <div className="mt-1 text-2xl font-black">{totalKm.toFixed(0)}</div>
            </div>
          </div>
        )}
        {rides.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <Route size={48} className="text-muted-foreground" />
            <p className="text-muted-foreground">No rides yet. Hit the orange RIDE button on the map to start your first ride!</p>
          </div>
        ) : (
          <div className="space-y-3 landscape:grid landscape:grid-cols-2 landscape:gap-3 landscape:space-y-0">
            {rides.map((ride) => <RideCard key={ride.id} ride={ride} />)}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}