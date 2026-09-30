import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, MapPin, Pencil, Trash2, Bell, BellOff, Users, Crown, Power, Save, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const RADII=[250,500,1000,2000,5000,10000];

export default function SavedPlaces() {
  const navigate=useNavigate();
  const qc=useQueryClient();
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState(null);
  const [busy,setBusy]=useState(false);

  const {data:user}=useQuery({queryKey:['me'],queryFn:async()=>base44.auth.me()});
  const {data:places=[],isLoading}=useQuery({
    queryKey:['saved-places',user?.id],
    queryFn:()=>base44.entities.SavedPlace.filter({},'-created_date',50),
    enabled:!!user?.id
  });
  const {data:groups=[]}=useQuery({
    queryKey:['saved-place-groups',user?.id],
    queryFn:async()=>{
      const memberships=await base44.entities.GroupMember.filter({user_id:user.id,status:'active'});
      const all=await base44.entities.Group.list('-created_date',100);
      const ids=new Set((memberships||[]).map(m=>m.group_id));
      return (all||[]).filter(g=>ids.has(g.id));
    },
    enabled:!!user?.id
  });

  const premium=user?.subscription_tier==='premium';
  const limit=premium?16:2;
  const activeCount=places.filter(p=>p.active!==false).length;

  const startEdit=(p)=>setEditing(p.id)||setForm({...p,group_ids:p.group_ids||[]});
  const cancel=()=>{setEditing(null);setForm(null);};

  const save=async()=>{
    if(!form?.name?.trim()) return toast.error('Enter a place name');
    setBusy(true);
    try{
      const res=await base44.functions.invoke('saved-place-geofence',{action:'update',place_id:editing,place:{
        name:form.name.trim(),lat:Number(form.lat),lng:Number(form.lng),radius_m:Number(form.radius_m),
        notify_enter:!!form.notify_enter,notify_exit:!!form.notify_exit,group_ids:form.group_ids||[],active:form.active!==false
      }});
      if(res.data?.error) throw new Error(res.data.error);
      toast.success('Saved Place updated'); cancel(); qc.invalidateQueries({queryKey:['saved-places',user?.id]});
    }catch(e){toast.error(e.message||'Could not update place');}finally{setBusy(false);}
  };

  const remove=async(p)=>{
    if(!confirm(`Delete "${p.name}"?`)) return;
    setBusy(true);
    try{
      const res=await base44.functions.invoke('saved-place-geofence',{action:'delete',place_id:p.id});
      if(res.data?.error) throw new Error(res.data.error);
      toast.success('Saved Place deleted'); qc.invalidateQueries({queryKey:['saved-places',user?.id]});
    }catch(e){toast.error(e.message||'Could not delete place');}finally{setBusy(false);}
  };

  const toggleActive=async(p)=>{
    setBusy(true);
    try{
      const res=await base44.functions.invoke('saved-place-geofence',{action:'update',place_id:p.id,place:{active:p.active===false}});
      if(res.data?.error) throw new Error(res.data.error);
      qc.invalidateQueries({queryKey:['saved-places',user?.id]});
    }catch(e){toast.error(e.message||'Could not update place');}finally{setBusy(false);}
  };

  const toggleGroup=(id)=>setForm(f=>({...f,group_ids:(f.group_ids||[]).includes(id)?f.group_ids.filter(x=>x!==id):[...(f.group_ids||[]),id]}));

  return <div className="min-h-screen bg-background pb-24" style={{paddingTop:'env(safe-area-inset-top)'}}>
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 p-4 backdrop-blur-lg">
      <button onClick={()=>navigate(-1)} className="glove-target rounded-full" aria-label="Back"><ChevronLeft size={26}/></button>
      <div className="min-w-0 flex-1"><h1 className="text-xl font-bold">Saved Places</h1><p className="text-xs text-muted-foreground">{activeCount} of {limit} active · {premium?'Premium':'Free'}</p></div>
      <MapPin size={22} className="text-primary"/>
    </div>

    <div className="mx-auto max-w-2xl space-y-3 p-4">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <p className="font-semibold">Arrival & departure alerts</p>
        <p className="mt-1 text-xs text-muted-foreground">Saved Places can notify selected groups when you enter or leave a geofence.</p>
      </div>

      {isLoading ? <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">Loading…</div> :
       places.length===0 ? <div className="rounded-2xl border border-border bg-card p-8 text-center"><MapPin className="mx-auto mb-3 text-muted-foreground"/><p className="font-semibold">No Saved Places</p><p className="mt-1 text-sm text-muted-foreground">Long-press the Home map to save a place.</p></div> :
       places.map(p=>editing===p.id&&form ? <div key={p.id} className="rounded-2xl border border-primary/30 bg-card p-4 space-y-4">
         <div className="flex items-center justify-between"><h2 className="font-bold">Edit Saved Place</h2><Button variant="ghost" size="icon" onClick={cancel}><X/></Button></div>
         <Input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/>
         <div><p className="mb-2 text-sm font-medium">Radius</p><div className="grid grid-cols-3 gap-2">{RADII.map(r=><Button key={r} variant={Number(form.radius_m)===r?'default':'outline'} size="sm" onClick={()=>setForm({...form,radius_m:r})}>{r<1000?r+' m':r/1000+' km'}</Button>)}</div></div>
         <div className="flex items-center justify-between"><span className="text-sm">Entry notification</span><Switch checked={!!form.notify_enter} onCheckedChange={v=>setForm({...form,notify_enter:v})}/></div>
         <div className="flex items-center justify-between"><span className="text-sm">Exit notification</span><Switch checked={!!form.notify_exit} onCheckedChange={v=>setForm({...form,notify_exit:v})}/></div>
         <div><p className="mb-2 text-sm font-medium">Groups</p>{groups.length?groups.map(g=><label key={g.id} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={(form.group_ids||[]).includes(g.id)} onChange={()=>toggleGroup(g.id)}/>{g.name}</label>):<p className="text-xs text-muted-foreground">No active groups.</p>}</div>
         <div className="flex items-center justify-between"><span className="text-sm">Geofence active</span><Switch checked={form.active!==false} onCheckedChange={v=>setForm({...form,active:v})}/></div>
         <Button className="w-full" onClick={save} disabled={busy}><Save size={16} className="mr-2"/>Save Changes</Button>
       </div> :
       <div key={p.id} className={`rounded-2xl border bg-card p-4 ${p.active===false?'opacity-60':''}`}>
         <div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2"><MapPin className="text-primary"/></div><div className="min-w-0 flex-1"><p className="font-semibold truncate">{p.name}</p><p className="text-xs text-muted-foreground">{Number(p.radius_m||1000)>=1000?Number(p.radius_m)/1000+' km':p.radius_m+' m'} radius · {p.active===false?'Disabled':'Active'}</p><div className="mt-2 flex flex-wrap gap-2 text-[11px]">{p.notify_enter&&<span className="rounded-full bg-secondary px-2 py-1"><Bell size={11} className="mr-1 inline"/>Entry</span>}{p.notify_exit&&<span className="rounded-full bg-secondary px-2 py-1"><BellOff size={11} className="mr-1 inline"/>Exit</span>}{(p.group_ids||[]).length>0&&<span className="rounded-full bg-secondary px-2 py-1"><Users size={11} className="mr-1 inline"/>{p.group_ids.length} group{p.group_ids.length===1?'':'s'}</span>}</div></div></div>
         <div className="mt-3 flex gap-2"><Button variant="outline" className="flex-1" onClick={()=>startEdit(p)}><Pencil size={15} className="mr-2"/>Edit</Button><Button variant="outline" size="icon" onClick={()=>toggleActive(p)} disabled={busy} title={p.active===false?'Enable':'Disable'}><Power size={16}/></Button><Button variant="outline" size="icon" className="text-destructive" onClick={()=>remove(p)} disabled={busy}><Trash2 size={16}/></Button></div>
       </div>)}
    </div>
  </div>;
}