import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import GroupRideCard from './GroupRideCard';
import CreateRideDialog from './CreateRideDialog';
import { toast } from 'sonner';

export default function GroupRidesList({ user, groups = [], memberships = [] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [userPos, setUserPos] = useState(null);

  const memberGroupIds = new Set(memberships.map((m) => m.group_id));
  const myGroups = groups.filter((g) => memberGroupIds.has(g.id));

  const { data: rides = [], isLoading } = useQuery({
    queryKey: ['group-rides'],
    queryFn: async () => {
      const all = await base44.entities.GroupRide.list('-planned_date', 100);
      return (all || []).filter((r) => memberGroupIds.has(r.group_id));
    },
    enabled: !!user?.id,
  });

  const { data: counts = {} } = useQuery({
    queryKey: ['ride-counts', rides.map((r) => r.id).join(',')],
    queryFn: async () => {
      const entries = await Promise.all(rides.map(async (r) => {
        const parts = await base44.entities.RideParticipant.filter({ group_ride_id: r.id }, '-last_updated', 100);
        return [r.id, parts.length];
      }));
      return Object.fromEntries(entries);
    },
    enabled: rides.length > 0,
  });

  useState(() => {
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => setUserPos([p.coords.latitude, p.coords.longitude]), () => {}, { enableHighAccuracy: true, timeout: 8000 });
  }, []);

  const active = rides.filter((r) => ['planning', 'waiting', 'riding', 'paused'].includes(r.status));
  const finished = rides.filter((r) => r.status === 'finished');

  const handleCreated = (id) => {
    queryClient.invalidateQueries({ queryKey: ['group-rides'] });
    if (id) navigate(`/ride/group/${id}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-muted-foreground">Group Rides</h2>
        <Button size="sm" className="min-h-[40px]" disabled={myGroups.length === 0} onClick={() => setCreateOpen(true)}><Plus size={16} className="mr-1" /> Plan Ride</Button>
      </div>

      {myGroups.length === 0 && (
        <div className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground">Join or create a group first, then plan a ride.</div>
      )}

      {isLoading && <div className="h-40 animate-pulse rounded-3xl bg-card" />}

      {!isLoading && active.length === 0 && myGroups.length > 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-card py-8 text-center">
          <Users size={32} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No active rides. Plan one to get rolling.</p>
        </div>
      )}

      <div className="space-y-3">
        {active.map((r, i) => (
          <GroupRideCard key={r.id} ride={r} participantCount={counts[r.id] || 0} userPos={userPos} index={i} onOpen={() => navigate(`/ride/group/${r.id}`)} />
        ))}
      </div>

      {finished.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-muted-foreground">Past Rides</h2>
          {finished.map((r, i) => (
            <GroupRideCard key={r.id} ride={r} participantCount={counts[r.id] || 0} index={i} onOpen={() => navigate(`/ride/group/${r.id}`)} />
          ))}
        </div>
      )}

      <CreateRideDialog open={createOpen} onClose={() => setCreateOpen(false)} user={user} groups={myGroups} memberships={memberships} onCreated={handleCreated} />
    </div>
  );
}