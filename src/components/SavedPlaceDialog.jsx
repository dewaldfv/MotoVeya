import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Bell, BellOff, Users, Crown, X, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import GeofencePreview from '@/components/GeofencePreview';
import { toast } from 'sonner';

const RADII = [5, 10, 25, 50, 75, 100];

export default function SavedPlaceDialog({ position, user, onClose, onSaved, editPlace }) {
  const navigate = useNavigate();
  const isEdit = !!editPlace;
  const [name, setName] = useState(editPlace?.name || '');
  const [radius, setRadius] = useState(editPlace?.radius_m || 50);
  const [enter, setEnter] = useState(editPlace?.notify_enter !== false);
  const [exit, setExit] = useState(editPlace?.notify_exit !== false);
  const [active, setActive] = useState(editPlace?.active !== false);
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState(editPlace?.group_ids || []);
  const [saving, setSaving] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const [premium, setPremium] = useState(false);
  const limit = premium ? 64 : 2;

  useEffect(() => {
    if (!user?.id) return;
    base44.functions.invoke('get-current-entitlement', {})
      .then((res) => setPremium(res.data?.is_premium === true))
      .catch(() => {});
    Promise.all([
      base44.entities.GroupMember.filter({ user_id: user.id, status: 'active' }, '-created_date', 50),
      base44.entities.Group.filter({ is_active: true }, '-created_date', 100)
    ]).then(([members, allGroups]) => {
      const ids = new Set((members || []).map(m => m.group_id));
      setGroups((allGroups || []).filter(g => ids.has(g.id)));
    }).catch(() => setGroups([]));
  }, [user?.id]);

  // Reverse-geocode the tapped point for a default name guess (create mode only).
  useEffect(() => {
    if (isEdit || !position) return;
    let cancelled = false;
    base44.functions.invoke('reverse-geocode', { lat: position.lat, lng: position.lng })
      .then((res) => { if (!cancelled && res.data?.name && !name) setName(res.data.name); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isEdit, position]);

  const toggleGroup = (id) => setSelectedGroups(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const save = async () => {
    if (!name.trim()) return toast.error('Give this Saved Place a name');
    setSaving(true);
    try {
      const placeData = {
        name: name.trim(),
        lat: isEdit ? editPlace.lat : position.lat,
        lng: isEdit ? editPlace.lng : position.lng,
        radius_m: radius,
        notify_enter: enter, notify_exit: exit,
        group_ids: selectedGroups, active
      };
      const res = isEdit
        ? await base44.functions.invoke('saved-place-geofence', { action: 'update', place_id: editPlace.id, place: placeData })
        : await base44.functions.invoke('saved-place-geofence', { action: 'create', place: placeData });
      if (res.data?.error === 'GEofence_LIMIT') {
        setLimitHit(true);
        return;
      }
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(isEdit ? 'Saved Place updated' : 'Saved Place created');
      onSaved?.(res.data.place);
      onClose();
    } catch (e) { toast.error(e.message || 'Could not save place. Please try again.'); }
    finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-3 sm:items-center">
    <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl border bg-background shadow-2xl">
      {limitHit ? (
        <div className="p-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"><Crown className="text-primary" size={28} /></div>
          <h2 className="text-lg font-bold">You've reached the Free limit</h2>
          <p className="mt-1 text-sm text-muted-foreground">Free riders can save up to 2 saved zones. Upgrade to Premium for up to 64 and unlock group geofence alerts at scale.</p>
          <Button className="mt-4 w-full" onClick={() => { onClose(); navigate('/premium'); }}>
            <Crown size={16} className="mr-2" /> Go Premium
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={onClose}>Maybe later</Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between p-5 pb-2">
            <div><h2 className="text-lg font-bold flex items-center gap-2"><MapPin className="text-primary" size={20}/> {isEdit ? 'Edit Saved Place' : 'Save this Place'}</h2>
            <p className="text-xs text-muted-foreground mt-1">{(isEdit ? editPlace.lat : position.lat).toFixed(5)}, {(isEdit ? editPlace.lng : position.lng).toFixed(5)}</p></div>
            <Button variant="ghost" size="icon" onClick={onClose}><X size={20}/></Button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-5">
          <Input value={name} onChange={e=>setName(e.target.value)} placeholder="Place name (e.g. Clubhouse)" autoFocus />
          <div className="mt-4"><div className="mb-2 text-sm font-medium">Geofence radius</div>
            <div className="grid grid-cols-3 gap-2">{RADII.map(r=><Button key={r} type="button" variant={radius===r?'default':'outline'} size="sm" onClick={()=>setRadius(r)}>{`${r} m`}</Button>)}</div>
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Bell size={17}/><span className="text-sm">Notify group on entry</span></div><Switch checked={enter} onCheckedChange={setEnter}/></div>
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><BellOff size={17}/><span className="text-sm">Notify group on exit</span></div><Switch checked={exit} onCheckedChange={setExit}/></div>
            {isEdit && <div className="flex items-center justify-between"><span className="text-sm">Geofence active</span><Switch checked={active} onCheckedChange={setActive}/></div>}
          </div>
          <div className="mt-4 rounded-2xl border p-3">
            <div className="flex items-center gap-2 text-sm font-medium"><Users size={17}/> Notify these groups</div>
            {groups.length===0?<p className="mt-2 text-xs text-muted-foreground">Join a group to send arrival/departure notifications.</p>:
            <div className="mt-2 space-y-2 max-h-32 overflow-auto">{groups.map(g=><label key={g.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedGroups.includes(g.id)} onChange={()=>toggleGroup(g.id)}/><span>{g.name}</span></label>)}</div>}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>{limit} active Saved Places allowed</span>{!premium&&<span className="flex items-center gap-1"><Crown size={13}/> Premium: 64</span>}</div>
          <GeofencePreview name={name} radius={radius} enter={enter} exit={exit} active={active} groupNames={groups.filter(g=>selectedGroups.includes(g.id)).map(g=>g.name)} />
          </div>
          <div className="border-t p-5 pt-3"><Button className="w-full" onClick={save} disabled={saving}><Save size={16} className="mr-2"/>{saving ? 'Saving…' : (isEdit ? 'Update Place' : 'Save Place')}</Button></div>
        </>
      )}
    </div>
  </div>;
}