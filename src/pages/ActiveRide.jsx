import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Navigation, Siren, AlertTriangle, X, Fuel, Search, ChevronLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import MapView from '@/components/MapView';

const SA_CENTER = [-26.2041, 28.0473];

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

function StatBlock({ label, value, unit }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-black leading-none">{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{unit || label}</div>
    </div>
  );
}

export default function ActiveRide() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialDest = location.state?.destination;
  const initialSearch = location.state?.searchText;

  const [user, setUser] = useState(null);
  const [bike, setBike] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fuelRemaining, setFuelRemaining] = useState(null);
  const [fuelRange, setFuelRange] = useState(null);
  const [destInput, setDestInput] = useState(initialSearch || '');
  const [destination, setDestination] = useState(initialDest || null);
  const [route, setRoute] = useState(null);
  const [crashCountdown, setCrashCountdown] = useState(null);
  const [distressActive, setDistressActive] = useState(false);
  const [ending, setEnding] = useState(false);

  const lastPosRef = useRef(null);
  const positionsRef = useRef([]);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (!authed) return;
        const me = await base44.auth.me();
        setUser(me);
        const bikes = await base44.entities.Bike.filter({ is_primary: true }, '-created_date', 1);
        if (bikes.length > 0) setBike(bikes[0]);
        else { const allBikes = await base44.entities.Bike.list('-created_date', 1); if (allBikes.length > 0) setBike(allBikes[0]); }
      } catch (e) { console.error(e); }
    })();
  }, []);

  useEffect(() => {
    if (initialDest) handleDestination(initialDest);
    else if (initialSearch) { setDestInput(initialSearch); handleSearch(initialSearch); }
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(newPos);
        positionsRef.current.push(newPos);
        const spd = pos.coords.speed != null && pos.coords.speed > 0 ? pos.coords.speed * 3.6 : 0;
        setSpeed(Math.round(spd));
        setMaxSpeed((prev) => (spd > prev ? Math.round(spd) : prev));
        if (lastPosRef.current) {
          const d = haversine(lastPosRef.current[0], lastPosRef.current[1], newPos[0], newPos[1]);
          if (d > 0.005) setDistance((prev) => prev + d);
        }
        lastPosRef.current = newPos;
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (bike && bike.tank_capacity_l && bike.fuel_consumption_l_per_100km) {
      const consumed = distance * (bike.fuel_consumption_l_per_100km / 100);
      const remaining = Math.max(0, bike.tank_capacity_l - consumed);
      const range = remaining > 0 ? (remaining / bike.fuel_consumption_l_per_100km) * 100 : 0;
      setFuelRemaining(Math.round(remaining * 10) / 10);
      setFuelRange(Math.round(range));
    }
  }, [distance, bike]);

  useEffect(() => {
    if (crashCountdown === null) return;
    if (crashCountdown <= 0) { handleCrashConfirmed(); return; }
    const t = setTimeout(() => setCrashCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [crashCountdown]);

  const handleSearch = async (query) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=za`);
      const data = await res.json();
      if (data.length > 0) {
        const dest = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: data[0].display_name.split(',')[0] };
        handleDestination(dest);
      }
    } catch (e) { console.error(e); }
  };

  const handleDestination = async (dest) => {
    setDestination(dest);
    setDestInput(dest.name);
    const start = userPos || SA_CENTER;
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${dest.lng},${dest.lat}?overview=full&geometries=geojson`);
      const data = await res.json();
      if (data.routes?.[0]) {
        setRoute(data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]));
      }
    } catch (e) { console.error(e); }
  };

  const handleSimulateCrash = () => setCrashCountdown(30);
  const handleCancelCrash = () => setCrashCountdown(null);

  const handleCrashConfirmed = async () => {
    setCrashCountdown(null);
    const pos = userPos || SA_CENTER;
    try {
      await base44.entities.CrashAlert.create({
        rider_id: user?.id, rider_name: user?.nickname || user?.full_name || 'Rider',
        lat: pos[0], lng: pos[1], timestamp: new Date().toISOString(),
        status: 'active', is_premium: user?.subscription_tier === 'premium',
        notified_emergency_contact: true, notified_emergency_services: user?.subscription_tier === 'premium',
        notified_nearby_riders: user?.subscription_tier === 'premium',
      });
      if (user?.emergency_contact_phone) {
        await base44.integrations.Core.SendEmail({
          to: '', subject: 'MotoGo Crash Alert',
          body: `Emergency: ${user?.nickname || user?.full_name} may have been in a crash at ${pos[0]}, ${pos[1]}. https://www.openstreetmap.org/?mlat=${pos[0]}&mlon=${pos[1]}#map=16/${pos[0]}/${pos[1]}`,
        });
      }
      if (user?.subscription_tier === 'premium') setDistressActive(true);
    } catch (e) { console.error(e); }
  };

  const handleDistress = async () => {
    const pos = userPos || SA_CENTER;
    try {
      await base44.entities.DistressAlert.create({
        rider_id: user?.id, rider_name: user?.nickname || user?.full_name || 'Rider',
        lat: pos[0], lng: pos[1], timestamp: new Date().toISOString(),
        status: 'active', reason: 'Manual distress signal',
        last_lat: pos[0], last_lng: pos[1], last_updated: new Date().toISOString(),
      });
      setDistressActive(true);
    } catch (e) { console.error(e); }
  };

  const handleEndRide = async () => {
    setEnding(true);
    try {
      const mins = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 60000));
      const avg = mins > 0 ? distance / (mins / 60) : 0;
      const fuelUsed = bike ? distance * (bike.fuel_consumption_l_per_100km / 100) : 0;
      const ride = await base44.entities.Ride.create({
        title: destination ? `Ride to ${destination.name}` : 'Free Ride',
        start_lat: positionsRef.current[0]?.[0], start_lng: positionsRef.current[0]?.[1],
        end_lat: userPos?.[0], end_lng: userPos?.[1],
        distance_km: Math.round(distance * 100) / 100, duration_minutes: mins,
        average_speed_kmh: Math.round(avg * 10) / 10, max_speed_kmh: maxSpeed,
        fuel_consumed_l: Math.round(fuelUsed * 10) / 10,
        route_polyline: JSON.stringify(positionsRef.current), bike_id: bike?.id,
        status: 'completed', ride_date: new Date(startTimeRef.current).toISOString(),
      });
      if (user) {
        await base44.auth.updateMe({
          total_distance_km: Math.round(((user.total_distance_km || 0) + distance) * 100) / 100,
          total_rides: (user.total_rides || 0) + 1,
        });
      }
      navigate(`/rides/${ride.id}`);
    } catch (e) {
      console.error(e);
      setEnding(false);
    }
  };

  const lowFuel = fuelRange !== null && fuelRange < 50;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <MapView
        center={userPos || SA_CENTER}
        zoom={14}
        route={route}
        riders={userPos ? [{ id: 'me', lat: userPos[0], lng: userPos[1] }] : []}
        distressAlerts={distressActive && userPos ? [{ id: 'me', lat: userPos[0], lng: userPos[1] }] : []}
        className="absolute inset-0 z-0 h-full w-full"
      />

      <div className="absolute left-0 right-0 top-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4 pb-10" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => navigate('/')} className="glove-target flex items-center justify-center rounded-full bg-card/90">
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-1 items-center gap-2 rounded-2xl bg-card/95 px-4 py-2.5 backdrop-blur-lg">
            <Search size={18} className="text-muted-foreground" />
            <input
              value={destInput}
              onChange={(e) => setDestInput(e.target.value)}
              placeholder="Set destination..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => { if (e.key === 'Enter' && destInput) handleSearch(destInput); }}
            />
            {destInput && (
              <button onClick={() => { setDestInput(''); setDestination(null); setRoute(null); }}>
                <X size={16} className="text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-card/95 px-4 py-3 shadow-lg backdrop-blur-lg">
          <StatBlock label="SPEED" value={speed} unit="km/h" />
          <div className="h-8 w-px bg-border" />
          <StatBlock label="DISTANCE" value={distance.toFixed(1)} unit="km" />
          <div className="h-8 w-px bg-border" />
          <StatBlock label="TIME" value={fmtTime(duration)} unit="" />
          <div className="h-8 w-px bg-border" />
          <div className={`text-center ${lowFuel ? 'text-destructive' : ''}`}>
            <div className="flex items-center justify-center gap-1 text-2xl font-black leading-none">
              <Fuel size={16} />{fuelRange ?? '—'}
            </div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">km range</div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 to-transparent p-4 pt-10">
        <div className="flex gap-2">
          {!distressActive ? (
            <button
              onClick={handleDistress}
              disabled={!user || user.subscription_tier !== 'premium'}
              className="flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-2xl bg-destructive font-bold text-destructive-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-40"
            >
              <Siren size={22} /> DISTRESS
            </button>
          ) : (
            <div className="flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-2xl bg-destructive font-bold text-destructive-foreground animate-pulse">
              <Siren size={22} /> DISTRESS ACTIVE
            </div>
          )}
          <button
            onClick={handleSimulateCrash}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-card px-5 font-bold shadow-lg transition-transform active:scale-95"
          >
            <AlertTriangle size={22} className="text-destructive" /> CRASH
          </button>
          <button
            onClick={handleEndRide}
            disabled={ending}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-primary px-6 font-bold text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-50"
          >
            {ending ? '...' : 'END'}
          </button>
        </div>
      </div>

      {crashCountdown !== null && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-destructive/95">
          <AlertTriangle size={72} className="mb-4 text-white" />
          <p className="mb-2 text-2xl font-bold text-white">CRASH DETECTED</p>
          <p className="mb-6 text-lg text-white/80">Emergency alert in</p>
          <div className="mb-8 text-8xl font-black text-white">{crashCountdown}</div>
          <button onClick={handleCancelCrash} className="min-h-[64px] rounded-2xl bg-white px-12 text-xl font-bold text-destructive active:scale-95">
            I'M OK — CANCEL
          </button>
        </div>
      )}
    </div>
  );
}