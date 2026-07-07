import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RIDE_ICONS, geocode } from '@/lib/groupRide';
import { notifyFriendsOfGroupRide } from '@/lib/rideInvite';
import { getOrCreateVoiceChannelForRide } from '@/lib/voiceChannel';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function CreateRideDialog({ open, onClose, user, groups = [], onCreated }) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState(RIDE_ICONS[0]);
  const [groupId, setGroupId] = useState(groups[0]?.id || '');
  const [destination, setDestination] = useState('');
  const [fuelStop, setFuelStop] = useState('');
  const [restStop, setRestStop] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !groupId) { toast.error('Add a title and pick a group'); return; }
    setSaving(true);
    try {
      const dest = await geocode(destination);
      const fuel = fuelStop ? await geocode(fuelStop) : null;
      const rest = restStop ? await geocode(restStop) : null;
      const grp = groups.find((g) => g.id === groupId);
      const ride = await base44.entities.GroupRide.create({
        group_id: groupId,
        group_name: grp?.name || null,
        title: title.trim(),
        icon,
        status: 'planning',
        destination_name: dest?.name || destination.trim() || null,
        destination_lat: dest?.lat || null,
        destination_lng: dest?.lng || null,
        fuel_stop_name: fuel?.name || (fuelStop.trim() || null),
        fuel_stop_lat: fuel?.lat || null,
        fuel_stop_lng: fuel?.lng || null,
        rest_stop_name: rest?.name || (restStop.trim() || null),
        rest_stop_lat: rest?.lat || null,
        rest_stop_lng: rest?.lng || null,
        planned_date: new Date().toISOString(),
        leader_id: user.id,
        leader_name: user.nickname || user.full_name,
      });
      toast.success('Ride planned');
      await getOrCreateVoiceChannelForRide(ride, user);
      const notified = await notifyFriendsOfGroupRide(user, ride);
      if (notified > 0) toast.success(`Ride invite sent to ${notified} friend${notified > 1 ? 's' : ''}`);
      setTitle(''); setDestination(''); setFuelStop(''); setRestStop('');
      onClose();
      onCreated(ride.id);
    } catch (e) {
      console.error(e);
      toast.error('Could not create ride');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Plan a Group Ride</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Ride Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sunday Breakfast Run" />
          </div>
          <div>
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {RIDE_ICONS.map((ic) => (
                <button key={ic} onClick={() => setIcon(ic)} className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${icon === ic ? 'bg-primary/20 ring-2 ring-primary' : 'bg-secondary'}`}>{ic}</button>
              ))}
            </div>
          </div>
          <div>
            <Label>Group *</Label>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Destination</Label>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Hartenbos, Mossel Bay" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fuel Stop</Label><Input value={fuelStop} onChange={(e) => setFuelStop(e.target.value)} placeholder="Engen Worcester" /></div>
            <div><Label>Rest Stop</Label><Input value={restStop} onChange={(e) => setRestStop(e.target.value)} placeholder="Padstal Robertson" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? 'Planning…' : 'Plan Ride'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}