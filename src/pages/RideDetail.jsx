import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, Gauge, Fuel, TrendingUp, Calendar, MapPin, Bike as BikeIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import MapView from '@/components/MapView';

export default function RideDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.Ride.get(id);
        setRide(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;
  if (!ride) return <div className="flex h-screen flex-col items-center justify-center gap-4"><p className="text-muted-foreground">Ride not found</p><button onClick={() => navigate('/rides')} className="text-primary">Back to rides</button></div>;

  const route = ride.route_polyline ? (() => { try { return JSON.parse(ride.route_polyline); } catch { return null; } })() : null;
  const date = new Date(ride.ride_date || ride.created_date).toLocaleString('en-ZA', { dateStyle: 'full', timeStyle: 'short' });
  const center = route ? route[Math.floor(route.length / 2)] : (ride.start_lat ? [ride.start_lat, ride.start_lng] : [-26.2041, 28.0473]);

  const stats = [
    { icon: TrendingUp, label: 'Distance', value: `${ride.distance_km?.toFixed(1) || 0} km` },
    { icon: Clock, label: 'Duration', value: `${ride.duration_minutes || 0} min` },
    { icon: Gauge, label: 'Avg Speed', value: `${ride.average_speed_kmh?.toFixed(0) || 0} km/h` },
    { icon: Gauge, label: 'Max Speed', value: `${ride.max_speed_kmh || 0} km/h` },
    { icon: Fuel, label: 'Fuel Used', value: ride.fuel_consumed_l ? `${ride.fuel_consumed_l.toFixed(1)} L` : '—' },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="relative h-64 w-full">
        <MapView center={center} zoom={13} route={route} className="absolute inset-0 h-full w-full" />
        <div className="absolute left-4 z-10" style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}>
          <button onClick={() => navigate('/rides')} className="glove-target flex items-center justify-center rounded-full bg-card/95 backdrop-blur-lg">
            <ChevronLeft size={24} />
          </button>
        </div>
      </div>

      <div className="p-4">
        <h1 className="text-2xl font-bold">{ride.title}</h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar size={14} /> {date}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground"><s.icon size={16} /><span className="text-xs font-semibold uppercase">{s.label}</span></div>
              <div className="mt-1 text-xl font-black">{s.value}</div>
            </div>
          ))}
        </div>

        {ride.start_location_name && (
          <div className="mt-4 rounded-2xl bg-card p-4">
            <div className="flex items-center gap-2 text-sm"><MapPin size={16} className="text-primary" /> {ride.start_location_name}</div>
          </div>
        )}

        {ride.notes && (
          <div className="mt-4 rounded-2xl bg-card p-4">
            <h3 className="mb-2 font-semibold">Notes</h3>
            <p className="text-sm text-muted-foreground">{ride.notes}</p>
          </div>
        )}

        {ride.photo_urls?.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 font-semibold">Photos</h3>
            <div className="grid grid-cols-2 gap-2">
              {ride.photo_urls.map((url, i) => <img key={i} src={url} alt={`Ride photo ${i + 1}`} className="h-32 w-full rounded-xl object-cover" />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}