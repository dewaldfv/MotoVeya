import { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Route, Clock, Calendar, Fuel, Bike, Trophy, Camera } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import RiderAvatar from '@/components/community/RiderAvatar';
import StatusBadge from '@/components/community/StatusBadge';
import StreakBadge from '@/components/community/StreakBadge';
import MiniActivityChart from '@/components/community/MiniActivityChart';
import RiderQuickActions from '@/components/community/RiderQuickActions';
import FriendLocationSheet from '@/components/community/FriendLocationSheet';
import LoginPrompt from '@/components/LoginPrompt';
import { formatDistance, formatDuration, formatRelativeDate, onlineStatus, computeAchievements } from '@/lib/riderStats';
import { inviteFriendToRide } from '@/lib/rideInvite';
import { toast } from 'sonner';

function StatTile({ icon: Icon, value, label }) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center shadow-sm">
      <Icon size={18} className="mx-auto mb-1 text-primary" />
      <p className="text-lg font-black">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-3xl bg-card p-4 shadow-sm">
      <h2 className="mb-3 font-bold">{title}</h2>
      {children}
    </div>
  );
}

export default function RiderProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const passedFriend = location.state?.friend;
  const [locSheet, setLocSheet] = useState(false);

  const { data: me, isLoading: meLoading } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const { data: rider, isLoading } = useQuery({
    queryKey: ['rider-stats', id],
    queryFn: async () => {
      const res = await base44.functions.invoke('get-rider-stats', { user_id: id });
      return res.data?.riders?.[0] || null;
    },
    enabled: !!id,
  });
  const { data: friend } = useQuery({
    queryKey: ['friend-record', id],
    queryFn: async () => {
      const [a, b] = await Promise.all([
        base44.entities.Friend.filter({ requester_id: me.id, recipient_id: id, status: 'accepted' }),
        base44.entities.Friend.filter({ recipient_id: me.id, requester_id: id, status: 'accepted' }),
      ]);
      return [...(a || []), ...(b || [])][0] || passedFriend || null;
    },
    enabled: !!me?.id && !!id,
  });

  if (meLoading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;
  if (!me) return <LoginPrompt message="Log in to view rider profiles" />;
  if (isLoading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;
  if (!rider) return <div className="p-6 text-center text-muted-foreground">Rider stats unavailable.</div>;

  const name = rider.nickname || rider.full_name || 'Rider';
  const status = onlineStatus(rider.weekly?.last_ride_date);
  const achievements = computeAchievements(rider);
  const locShared = friend?.location_shared && friend?.last_lat != null;

  const handleNavigate = () => {
    if (!locShared) { toast.error('Location not shared'); return; }
    navigate('/ride/active', { state: { destination: { lat: friend.last_lat, lng: friend.last_lng, name } } });
  };
  const handleInvite = async () => {
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, name: 'My location' }),
        () => rej(new Error('loc')),
        { enableHighAccuracy: true, timeout: 8000 }
      ));
      await inviteFriendToRide(me, id, pos);
      toast.success('Ride invite sent');
    } catch (e) {
      try { await inviteFriendToRide(me, id, null); toast.success('Ride invite sent'); }
      catch (_) { toast.error('Could not send invite'); }
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="glove-target flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-sm"><ChevronLeft size={22} /></button>
        <h1 className="text-xl font-bold">Rider Profile</h1>
      </div>

      <div className="mb-4 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative">
            <RiderAvatar src={rider.avatar_url} name={name} size={72} />
            <span className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card ${status.dot}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black">{name}</h2>
              <StreakBadge streak={rider.streak} />
            </div>
            <StatusBadge status={status} />
            {rider.motorcycle_club && <p className="text-xs text-muted-foreground">{rider.motorcycle_club}</p>}
            {rider.bike_make && <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Bike size={12} /> {rider.bike_make} {rider.bike_model || ''}{rider.bike_nickname ? ` · "${rider.bike_nickname}"` : ''}</p>}
          </div>
        </div>
        {rider.bio && <p className="mt-3 text-sm text-muted-foreground">{rider.bio}</p>}
        <div className="mt-4">
          <RiderQuickActions rider={rider} onShowLocation={() => setLocSheet(true)} onNavigate={handleNavigate} onInvite={handleInvite} />
        </div>
      </div>

      <div className="mb-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <StatTile icon={Route} value={formatDistance(rider.weekly?.distance_km)} label="This week" />
          <StatTile icon={Clock} value={formatDuration(rider.weekly?.ride_time_min)} label="Ride time" />
          <StatTile icon={Calendar} value={rider.weekly?.ride_count || 0} label="Rides" />
        </div>
        <Section title="7-Day Activity">
          <MiniActivityChart activity={rider.weekly?.activity} height={64} />
        </Section>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Section title="Monthly">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Distance</span><span className="font-bold">{formatDistance(rider.monthly?.distance_km)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-bold">{formatDuration(rider.monthly?.ride_time_min)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Rides</span><span className="font-bold">{rider.monthly?.ride_count || 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fuel</span><span className="font-bold">{rider.monthly?.fuel_l || 0} L</span></div>
          </div>
        </Section>
        <Section title="Fuel">
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2"><Fuel size={14} className="text-primary" /><span className="font-bold">{rider.fuel?.avg_consumption_l_per_100km || 0} L/100km</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Refills</span><span className="font-bold">{rider.fuel?.refill_count || 0}</span></div>
            {rider.fuel?.km_per_litre != null && <div className="flex justify-between"><span className="text-muted-foreground">km/L</span><span className="font-bold">{rider.fuel.km_per_litre}</span></div>}
            {rider.fuel?.estimated_range_km != null && <div className="flex justify-between"><span className="text-muted-foreground">Range</span><span className="font-bold">{rider.fuel.estimated_range_km} km</span></div>}
          </div>
        </Section>
      </div>

      <div className="mb-4">
        <Section title={`Achievements (${achievements.length})`}>
          {achievements.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {achievements.map((a) => (
                <div key={a.id} className="rounded-2xl bg-secondary/50 p-2 text-center">
                  <div className="text-2xl">{a.emoji}</div>
                  <p className="text-[10px] font-bold">{a.label}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No achievements yet — keep riding!</p>}
        </Section>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatTile icon={Route} value={rider.rides_completed || 0} label="Routes completed" />
        <StatTile icon={Trophy} value={rider.events_count || 0} label="Events" />
      </div>

      <div className="mb-4">
        <Section title="Ride History">
          {rider.history?.length > 0 ? (
            <div className="space-y-2">
              {rider.history.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-2xl bg-secondary/40 p-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground">{formatRelativeDate(r.ride_date)}{r.start_location_name ? ` · ${r.start_location_name}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{formatDistance(r.distance_km)}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDuration(r.duration_minutes)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No rides yet.</p>}
        </Section>
      </div>

      <div className="mb-4">
        <Section title={`Photos (${rider.photos?.length || 0})`}>
          {rider.photos?.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {rider.photos.map((url, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-2xl">
                  <img src={url} alt="Ride" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No photos shared yet.</p>}
        </Section>
      </div>

      <FriendLocationSheet open={locSheet} onClose={() => setLocSheet(false)} friend={friend} rider={rider} />
    </div>
  );
}