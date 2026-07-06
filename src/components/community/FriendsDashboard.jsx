import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import FriendCard from './FriendCard';
import WeeklyLeaderboard from './WeeklyLeaderboard';
import FriendLocationSheet from './FriendLocationSheet';
import { inviteFriendToRide } from '@/lib/rideInvite';
import { toast } from 'sonner';

export default function FriendsDashboard({ user, friends = [] }) {
  const navigate = useNavigate();
  const [locSheet, setLocSheet] = useState(null);

  const friendIds = useMemo(
    () => friends.map((f) => (f.requester_id === user.id ? f.recipient_id : f.requester_id)),
    [friends, user.id]
  );

  const { data: riders = [], isLoading } = useQuery({
    queryKey: ['rider-stats', friendIds.join(',')],
    queryFn: async () => {
      if (friendIds.length === 0) return [];
      const res = await base44.functions.invoke('get-rider-stats', { user_ids: friendIds });
      return res.data?.riders || [];
    },
    enabled: friendIds.length > 0,
    staleTime: 60_000,
  });

  const riderById = useMemo(() => {
    const m = new Map();
    riders.forEach((r) => m.set(r.user_id, r));
    return m;
  }, [riders]);

  const fidOf = (f) => (f.requester_id === user.id ? f.recipient_id : f.requester_id);

  const openProfile = (rider) => {
    const fid = rider?.user_id;
    const friend = friends.find((f) => fidOf(f) === fid);
    navigate(`/rider/${fid}`, { state: { friend } });
  };

  const handleNavigate = (friend) => {
    if (!friend?.location_shared || friend.last_lat == null) { toast.error('Location not shared'); return; }
    const rider = riderById.get(fidOf(friend));
    const name = rider?.nickname || rider?.full_name || 'Friend';
    navigate('/ride/active', { state: { destination: { lat: friend.last_lat, lng: friend.last_lng, name } } });
  };

  const handleInvite = async (rider) => {
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, name: 'My location' }),
        () => rej(new Error('loc')),
        { enableHighAccuracy: true, timeout: 8000 }
      ));
      await inviteFriendToRide(user, rider.user_id, pos);
      toast.success(`Invite sent to ${rider.nickname || rider.full_name || 'friend'}`);
    } catch (e) {
      try { await inviteFriendToRide(user, rider.user_id, null); toast.success('Ride invite sent'); }
      catch (err) { toast.error('Could not send invite'); }
    }
  };

  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Users size={40} className="text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No friends yet. Add riders by code, QR, or PIN.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WeeklyLeaderboard riders={riders} onSelect={openProfile} />
      <div className="space-y-3 landscape:grid landscape:grid-cols-2 landscape:gap-3 landscape:space-y-0">
        {friends.map((f, i) => {
          const fid = fidOf(f);
          const rider = riderById.get(fid);
          if (isLoading && !rider) return <div key={f.id} className="h-56 animate-pulse rounded-3xl bg-card" />;
          return (
            <FriendCard
              key={f.id}
              friend={f}
              rider={rider}
              user={user}
              index={i}
              onOpen={() => openProfile(rider || { user_id: fid })}
              onShowLocation={() => setLocSheet(f)}
              onNavigate={() => handleNavigate(f)}
              onInvite={() => handleInvite(rider || { user_id: fid })}
            />
          );
        })}
      </div>
      <FriendLocationSheet
        open={!!locSheet}
        onClose={() => setLocSheet(null)}
        friend={locSheet}
        rider={locSheet ? riderById.get(fidOf(locSheet)) : null}
      />
    </div>
  );
}