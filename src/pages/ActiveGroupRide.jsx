import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Crown, Shield, ShieldOff, Megaphone, Settings2, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import RideMapView from '@/components/grouprides/RideMapView';
import RiderStatusCard from '@/components/grouprides/RiderStatusCard';
import CommButtons from '@/components/grouprides/CommButtons';
import LeaderControls from '@/components/grouprides/LeaderControls';
import RideSummarySheet from '@/components/grouprides/RideSummarySheet';
import { RIDE_STATUS, COMM_SIGNALS, haversine, geocode, formatDuration } from '@/lib/groupRide';
import { getWeather } from '@/lib/weather';
import { toast } from 'sonner';

export default function ActiveGroupRide() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [ride, setRide] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [userPos, setUserPos] = useState(null);
  const [heading, setHeading] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [battery, setBattery] = useState(null);
  const [ridingStatus, setRidingStatus] = useState('stopped');
  const [route, setRoute] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [hazards, setHazards] = useState([]);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(null);
  const [leaderOpen, setLeaderOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const watchRef = useRef(null);
  const lastUploadRef = useRef(0);
  const distRef = useRef(0);
  const maxSpeedRef = useRef(0);
  const lastPosRef = useRef(null);
  const breadcrumbRef = useRef([]);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        setUser(me);
        const res = await base44.functions.invoke('get-group-ride-secure', { id });
        if (res.data?.access_denied) {
          setAccessDenied(res.data.reason || 'You are not a member of this group ride');
          return;
        }
        const r = res.data.ride;
        const parts = res.data.participants || [];
        setRide(r);
        setParticipants(parts);
        if (r?.status === 'finished') setSummaryOpen(true);
        if (r?.destination_lat != null) {
          getWeather(r.destination_lat, r.destination_lng).then(setWeather);
        }
      } catch (e) { console.error(e); toast.error('Could not load ride'); }
      finally { setLoading(false); }
    })();
  }, [id]);

  // Real-time subscription to participant updates
  useEffect(() => {
    const unsub = base44.entities.RideParticipant.subscribe((event) => {
      const p = event.data;
      if (!p || p.group_ride_id !== id) return;
      setParticipants((prev) => {
        if (event.type === 'delete') return prev.filter((x) => x.user_id !== p.user_id);
        const idx = prev.findIndex((x) => x.user_id === p.user_id);
        if (idx === -1) return [...prev, p];
        const copy = [...prev]; copy[idx] = { ...copy[idx], ...p }; return copy;
      });
    });
    return unsub;
  }, [id]);

  const isLeader = ride?.leader_id === user?.id;
  const rideStatus = RIDE_STATUS[ride?.status] || RIDE_STATUS.planning;
  const selfParticipant = participants.find((p) => p.user_id === user?.id);

  // GPS tracking + location upload
  useEffect(() => {
    if (!user || !ride || ride.status === 'finished') return;
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(newPos);
        if (pos.coords.heading != null && !isNaN(pos.coords.heading)) setHeading(pos.coords.heading);
        const spd = pos.coords.speed != null && pos.coords.speed > 0 ? pos.coords.speed * 3.6 : 0;
        setSpeed(Math.round(spd));
        if (spd > maxSpeedRef.current) maxSpeedRef.current = Math.round(spd);
        if (lastPosRef.current) {
          const d = haversine(lastPosRef.current[0], lastPosRef.current[1], newPos[0], newPos[1]);
          if (d > 0.01) {
            distRef.current += d;
            const now = Date.now();
            if (breadcrumbRef.current.length === 0 || now - (breadcrumbRef.current[breadcrumbRef.current.length - 1].t || 0) > 30000) {
              breadcrumbRef.current = [...breadcrumbRef.current, { lat: newPos[0], lng: newPos[1], t: now }].slice(-40);
              setBreadcrumb(breadcrumbRef.current.map((b) => [b.lat, b.lng]));
            }
          }
        }
        lastPosRef.current = newPos;

        const now = Date.now();
        if (now - lastUploadRef.current > 8000) {
          lastUploadRef.current = now;
          const gpsStatus = pos.coords.accuracy > 50 ? 'weak' : 'good';
          uploadLocation(newPos, spd, gpsStatus);
        }
      },
      () => { setRidingStatus('stopped'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
    );
    watchRef.current = watchId;
    return () => { navigator.geolocation.clearWatch(watchId); watchRef.current = null; };
  }, [user, ride, ridingStatus]);

  useEffect(() => {
    if (navigator.getBattery) {
      navigator.getBattery().then((b) => {
        const upd = () => setBattery(Math.round(b.level * 100));
        upd();
        b.addEventListener('levelchange', upd);
      }).catch(() => {});
    }
  }, []);

  const uploadLocation = async (pos, spd, gpsStatus) => {
    try {
      await base44.functions.invoke('update-rider-location', {
        group_ride_id: id,
        lat: pos[0], lng: pos[1],
        speed_kmh: spd,
        battery_level: battery,
        gps_status: gpsStatus,
        riding_status: ride?.status === 'riding' ? ridingStatus : 'stopped',
        distance_km: Math.round(distRef.current * 100) / 100,
        max_speed_kmh: maxSpeedRef.current,
      });
    } catch (e) { console.error(e); }
  };

  // Fetch route to destination via stops
  useEffect(() => {
    if (!ride?.destination_lat || !userPos) return;
    const wp = [];
    if (ride.fuel_stop_lat != null) wp.push(`${ride.fuel_stop_lng},${ride.fuel_stop_lat}`);
    if (ride.rest_stop_lat != null) wp.push(`${ride.rest_stop_lng},${ride.rest_stop_lat}`);
    const coords = [`${userPos[1]},${userPos[0]}`, ...wp, `${ride.destination_lng},${ride.destination_lat}`].join(';');
    fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`)
      .then((r) => r.json())
      .then((d) => { if (d.routes?.[0]) setRoute(d.routes[0].geometry.coordinates.map((c) => [c[1], c[0]])); })
      .catch(() => {});
  }, [userPos, ride]);

  // Fetch nearby hazards
  useEffect(() => {
    (async () => {
      try {
        const [crashes, distress] = await Promise.all([
          base44.entities.CrashAlert.filter({ status: 'active' }, '-created_date', 20),
          base44.entities.DistressAlert.filter({ status: 'active' }, '-created_date', 20),
        ]);
        setHazards([...(crashes || []), ...(distress || [])].filter((h) => h.lat != null));
      } catch (e) { console.error(e); }
    })();
  }, []);

  const distRemaining = useMemo(() => {
    if (!userPos || !ride?.destination_lat) return null;
    return Math.round(haversine(userPos[0], userPos[1], ride.destination_lat, ride.destination_lng) * 10) / 10;
  }, [userPos, ride]);

  const eta = distRemaining != null && distRemaining > 0 && speed > 5 ? Math.round((distRemaining / speed) * 60) : null;

  const broadcast = async (title, body, data) => {
    const others = participants.filter((p) => p.user_id !== user.id);
    if (others.length === 0) return;
    try {
      await base44.entities.Notification.bulkCreate(others.map((p) => ({
        type: 'group_update', title, body, recipient_id: p.user_id,
        data: data ? JSON.stringify(data) : null, action_url: `/ride/group/${id}`, is_read: false,
      })));
    } catch (e) { console.error(e); }
  };

  const handleSignal = async (sig) => {
    const name = user.nickname || user.full_name || 'Rider';
    broadcast(`${name}: ${sig.label}`, sig.label, { signal: sig.type });
    toast.success(`Sent: ${sig.label}`);
    if (sig.type === 'distress') {
      setRidingStatus('emergency');
      if (userPos) {
        try {
          await base44.entities.DistressAlert.create({
            rider_id: user.id, rider_name: name, lat: userPos[0], lng: userPos[1],
            timestamp: new Date().toISOString(), status: 'active', reason: 'Group ride distress signal',
            last_lat: userPos[0], last_lng: userPos[1], last_updated: new Date().toISOString(),
          });
        } catch (e) { console.error(e); }
      }
    } else if (sig.type === 'fuel') {
      setRidingStatus('fuel_stop');
    } else if (sig.type === 'coffee') {
      setRidingStatus('rest_stop');
    } else {
      setRidingStatus('riding');
    }
  };

  const handleStart = async () => {
    try { await base44.entities.GroupRide.update(id, { status: 'riding', started_at: new Date().toISOString() }); setRide({ ...ride, status: 'riding', started_at: new Date().toISOString() }); setLeaderOpen(false); toast.success('Ride started'); } catch (e) { toast.error('Could not start'); }
  };
  const handlePause = async () => {
    try { await base44.entities.GroupRide.update(id, { status: 'paused' }); setRide({ ...ride, status: 'paused' }); setLeaderOpen(false); toast.info('Ride paused'); } catch (e) { toast.error('Could not pause'); }
  };
  const handleEnd = async () => {
    try {
      const res = await base44.functions.invoke('generate-ride-summary', { group_ride_id: id });
      setRide({ ...ride, status: 'finished', summary: JSON.stringify(res.data.summary) });
      setLeaderOpen(false);
      setSummaryOpen(true);
      toast.success('Ride finished — summary generated');
    } catch (e) { console.error(e); toast.error('Could not end ride'); }
  };
  const handleAssign = async (p, role) => {
    try {
      if (role === 'leader') {
        await base44.entities.GroupRide.update(id, { leader_id: p.user_id, leader_name: p.user_name, sweep_id: p.user_id === ride.sweep_id ? null : ride.sweep_id });
        setRide({ ...ride, leader_id: p.user_id, leader_name: p.user_name });
      } else {
        await base44.entities.GroupRide.update(id, { sweep_id: p.user_id, sweep_name: p.user_name });
        setRide({ ...ride, sweep_id: p.user_id, sweep_name: p.user_name });
      }
      await base44.entities.RideParticipant.update(p.id, { role });
      setParticipants((prev) => prev.map((x) => x.id === p.id ? { ...x, role } : x));
      toast.success(`${p.user_name} is now ${role}`);
    } catch (e) { toast.error('Could not assign role'); }
  };
  const handleRemove = async (p) => {
    try { await base44.entities.RideParticipant.delete(p.id); setParticipants((prev) => prev.filter((x) => x.user_id !== p.user_id)); toast.success(`${p.user_name} removed`); } catch (e) { toast.error('Could not remove rider'); }
  };
  const handleBroadcast = () => {
    const msg = window.prompt('Broadcast message to all riders:');
    if (!msg) return;
    broadcast(`Leader: ${msg}`, msg, { broadcast: true });
    toast.success('Message broadcast');
  };
  const handleShareRoute = () => {
    const text = `Join my ride: ${ride.title}${ride.destination_name ? ` to ${ride.destination_name}` : ''}`;
    if (navigator.share) navigator.share({ title: ride.title, text }).catch(() => {});
    else { navigator.clipboard.writeText(text); toast.success('Route copied'); }
  };
  const handleEditStops = async () => {
    const fuel = window.prompt('Fuel stop name (leave blank to clear):', ride.fuel_stop_name || '');
    if (fuel === null) return;
    const rest = window.prompt('Rest stop name (leave blank to clear):', ride.rest_stop_name || '');
    if (rest === null) return;
    const fuelGeo = fuel.trim() ? await geocode(fuel) : null;
    const restGeo = rest.trim() ? await geocode(rest) : null;
    const upd = {
      fuel_stop_name: fuel.trim() ? (fuelGeo?.name || fuel.trim()) : null,
      fuel_stop_lat: fuelGeo?.lat || null, fuel_stop_lng: fuelGeo?.lng || null,
      rest_stop_name: rest.trim() ? (restGeo?.name || rest.trim()) : null,
      rest_stop_lat: restGeo?.lat || null, rest_stop_lng: restGeo?.lng || null,
    };
    await base44.entities.GroupRide.update(id, upd);
    setRide({ ...ride, ...upd });
    toast.success('Stops updated');
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (accessDenied) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <ShieldOff size={40} className="text-muted-foreground" />
      <h2 className="text-lg font-bold">Access Denied</h2>
      <p className="text-sm text-muted-foreground">{accessDenied}</p>
      <button onClick={() => navigate(-1)} className="mt-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Go Back</button>
    </div>
  );
  if (!ride) return <div className="p-6 text-center text-muted-foreground">Ride not found.</div>;

  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.role === 'leader') return -1; if (b.role === 'leader') return 1;
    if (a.role === 'sweep') return 1; if (b.role === 'sweep') return -1;
    return 0;
  });

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <div className="absolute inset-0 z-0">
        <RideMapView
          participants={participants}
          route={route}
          breadcrumb={breadcrumb}
          hazards={hazards}
          destination={ride.destination_lat != null ? { lat: ride.destination_lat, lng: ride.destination_lng } : null}
          fuelStop={ride.fuel_stop_lat != null ? { lat: ride.fuel_stop_lat, lng: ride.fuel_stop_lng } : null}
          restStop={ride.rest_stop_lat != null ? { lat: ride.rest_stop_lat, lng: ride.rest_stop_lng } : null}
          user={user}
          selfPos={userPos}
        />
      </div>

      <div className="absolute left-0 right-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-2 p-3">
          <button onClick={() => navigate(-1)} className="glove-target flex h-10 w-10 items-center justify-center rounded-full bg-card/95 shadow-lg backdrop-blur-lg"><ChevronLeft size={22} /></button>
          <div className="flex-1 rounded-2xl bg-card/95 px-3 py-2 shadow-lg backdrop-blur-lg">
            <div className="flex items-center gap-2">
              <span className="text-xl">{ride.icon || '🏍️'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{ride.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{ride.group_name}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${rideStatus.color}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${rideStatus.dot}`} /> {rideStatus.label}
              </span>
            </div>
          </div>
          {isLeader && ride.status !== 'finished' && (
            <button onClick={() => setLeaderOpen(true)} className="glove-target flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-lg text-primary-foreground"><Settings2 size={20} /></button>
          )}
        </div>
        <div className="flex gap-2 px-3 pb-2">
          {distRemaining != null && ride.status !== 'finished' && (
            <div className="rounded-full bg-card/95 px-3 py-1 text-xs font-bold shadow backdrop-blur-lg">{distRemaining} km to go</div>
          )}
          {eta != null && (
            <div className="rounded-full bg-card/95 px-3 py-1 text-xs font-bold shadow backdrop-blur-lg">ETA {formatDuration(eta)}</div>
          )}
          {weather && (
            <div className="rounded-full bg-card/95 px-3 py-1 text-xs font-medium shadow backdrop-blur-lg">{weather.icon} {weather.temp}°C · {weather.wind}km/h</div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 space-y-2 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <CommButtons onSignal={handleSignal} />
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {sortedParticipants.map((p) => (
            <RiderStatusCard key={p.user_id} p={p} isSelf={p.user_id === user?.id} onAction={isLeader ? () => setLeaderOpen(true) : null} />
          ))}
          {participants.length === 0 && <div className="rounded-2xl bg-card/95 p-3 text-sm text-muted-foreground">No riders joined yet.</div>}
        </div>
      </div>

      {isLeader && (
        <LeaderControls
          open={leaderOpen}
          onClose={() => setLeaderOpen(false)}
          ride={ride}
          participants={participants}
          user={user}
          onStart={handleStart}
          onPause={handlePause}
          onEnd={handleEnd}
          onAssign={handleAssign}
          onBroadcast={handleBroadcast}
          onShareRoute={handleShareRoute}
          onEditStops={handleEditStops}
          onRemove={handleRemove}
        />
      )}

      <RideSummarySheet open={summaryOpen} onClose={() => setSummaryOpen(false)} ride={ride} summary={ride.summary} />
    </div>
  );
}