import { useEffect, useMemo, useState } from 'react';
import { MapPin, Bell, BellOff, Users, Crown, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const RADII=[250,500,1000,2000,5000,10000];

export default function SavedPlaceDialog({ position, user, onClose, onSaved }) {
  const [name,setName]=useState('');
  const [radius,setRadius]=useState(1000);
  const [enter,setEnter]=useState(true);
  const [exit,setExit]=useState(true);
  const [groups,setGroups]=useState([]);
  const [selectedGroups,setSelectedGroups]=useState([]);
  const [saving,setSaving]=useState(false);
  const premium=user?.subscription_tier==='premium';
  const limit=premium?16:2;

  useEffect(()=>{
    if(!user?.id) return;
    Promise.all([
      base44.entities.GroupMember.filter({user_id:user.id,status:'active'},'-created_date',50),
      base44.entities.Group.filter({is_active:true},'-created_date',100)
    ]).then(([members,allGroups])=>{
      const ids=new Set((members||[]).map(m=>m.group_id));
      setGroups((allGroups||[]).filter(g=>ids.has(g.id)));
    }).catch(()=>setGroups([]));
  },[user?.id]);

  const toggleGroup=(id)=>setSelectedGroups(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);

  const save=async()=>{
    if(!name.trim()) return toast.error('Give this Saved Place a name');
    setSaving(true);
    try{
      const res=await base44.functions.invoke('saved-place-geofence',{
        action:'create',
        place:{name:name.trim(),lat:position.lat,lng:position.lng,radius_m:radius,notify_enter:enter,notify_exit:exit,group_ids:selectedGroups}
      });
      if(res.data?.error==='GEofence_LIMIT'){
        toast.error(`You have reached the ${res.data.limit} Saved Place limit.`);
        return;
      }
      if(res.data?.error) throw new Error(res.data.error);
      toast.success('Saved Place created');
      onSaved?.(res.data.place);
      onClose();
    }catch(e){ toast.error(e.message||'Could not save place'); }
    finally{setSaving(false);}
  };

  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-3 sm:items-center">
    <div className="w-full max-w-md rounded-3xl border bg-background p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div><h2 className="text-lg font-bold flex items-center gap-2"><MapPin className="text-primary" size={20}/> Save this Place</h2>
        <p className="text-xs text-muted-foreground mt-1">{position.lat.toFixed(5)}, {position.lng.toFixed(5)}</p></div>
        <Button variant="ghost" size="icon" onClick={onClose}><X size={20}/></Button>
      </div>
      <Input value={name} onChange={e=>setName(e.target.value)} placeholder="Place name (e.g. Clubhouse)" autoFocus />
      <div className="mt-4"><div className="mb-2 text-sm font-medium">Geofence radius</div>
        <div className="grid grid-cols-3 gap-2">{RADII.map(r=><Button key={r} type="button" variant={radius===r?'default':'outline'} size="sm" onClick={()=>setRadius(r)}>{r<1000?`${r} m`:`${r/1000} km`}</Button>)}</div>
      </div>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Bell size={17}/><span className="text-sm">Notify group on entry</span></div><Switch checked={enter} onCheckedChange={setEnter}/></div>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><BellOff size={17}/><span className="text-sm">Notify group on exit</span></div><Switch checked={exit} onCheckedChange={setExit}/></div>
      </div>
      <div className="mt-4 rounded-2xl border p-3">
        <div className="flex items-center gap-2 text-sm font-medium"><Users size={17}/> Notify these groups</div>
        {groups.length===0?<p className="mt-2 text-xs text-muted-foreground">Join a group to send arrival/departure notifications.</p>:
        <div className="mt-2 space-y-2 max-h-32 overflow-auto">{groups.map(g=><label key={g.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedGroups.includes(g.id)} onChange={()=>toggleGroup(g.id)}/><span>{g.name}</span></label>)}</div>}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>{limit} active Saved Places allowed</span>{!premium&&<span className="flex items-center gap-1"><Crown size={13}/> Premium: 16</span>}</div>
      <Button className="mt-4 w-full" onClick={save} disabled={saving}>{saving?'Saving…':'Save Place'}</Button>
    </div>
  </div>;
}