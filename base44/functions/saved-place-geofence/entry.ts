import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { resolveEntitlement } from '../../shared/entitlement.ts';
import { runGeofenceCheck } from '../../shared/savedPlaceGeofence.ts';

const haversineMeters = (lat1:number, lon1:number, lat2:number, lon2:number) => {
  const R=6371000, toRad=(v:number)=>v*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
};

const isRateLimit = (e:any) => e?.status===429 || /rate limit/i.test(e?.message||'');

// Retry a call on platform rate-limit (429) with short backoff so transient
// throttling from concurrent location pings doesn't surface as a hard 500.
async function withRetry<T>(fn:()=>Promise<T>, retries=2):Promise<T> {
  for(let i=0;i<=retries;i++){
    try{ return await fn(); }
    catch(e:any){ if(!isRateLimit(e)||i===retries) throw e; await new Promise(r=>setTimeout(r,500*(i+1))); }
  }
  throw new Error('unreachable');
}

Deno.serve(async (req) => {
  try {
    const base44=createClientFromRequest(req);
    const me=await withRetry(()=>base44.auth.me());
    if(!me) return Response.json({error:'Unauthorized'},{status:401});
    const body=await req.json().catch(()=>({}));
    const {action, place, place_id, lat, lng}=body||{};
    const svc=base44.asServiceRole;
    const { is_premium: isPremium } = await resolveEntitlement(svc, me.id);

    if(action==='create'){
      if(!place?.name || place.lat==null || place.lng==null) return Response.json({error:'Missing place fields'},{status:400});
      const existing=await withRetry(()=>svc.entities.SavedPlace.filter({created_by_id:me.id,active:true}));
      const limit=isPremium?64:2;
      if((existing||[]).length>=limit) return Response.json({error:'GEofence_LIMIT',limit},{status:409});
      const groupIds=Array.isArray(place.group_ids)?place.group_ids:[];
      if(groupIds.length){
        const memberships=await svc.entities.GroupMember.filter({user_id:me.id,status:'active'});
        const allowed=new Set((memberships||[]).map((m:any)=>m.group_id));
        if(groupIds.some((id:string)=>!allowed.has(id))) return Response.json({error:'Invalid group selection'},{status:403});
      }
      // Create via the USER's client (not service role) so created_by_id is
      // stamped with the user's id — the SavedPlace RLS read rule is
      // created_by_id==user.id, so a service-role create would be invisible.
      const created=await withRetry(()=>base44.entities.SavedPlace.create({
        name:String(place.name).trim(),lat:Number(place.lat),lng:Number(place.lng),
        radius_m:Math.max(5,Math.min(Number(place.radius_m)||50,100)),
        notify_enter:place.notify_enter!==false,notify_exit:place.notify_exit!==false,
        group_ids:groupIds,active:true,last_inside:false
      }));
      return Response.json({place:created});
    }

    if(action==='update'){
      if(!place_id) return Response.json({error:'Missing place_id'},{status:400});
      const current=await svc.entities.SavedPlace.get(place_id);
      if(!current || current.created_by_id!==me.id) return Response.json({error:'Not found'},{status:404});
      const groupIds=Array.isArray(place?.group_ids)?place.group_ids:(current.group_ids||[]);
      if(groupIds.length){
        const memberships=await svc.entities.GroupMember.filter({user_id:me.id,status:'active'});
        const allowed=new Set((memberships||[]).map((m:any)=>m.group_id));
        if(groupIds.some((id:string)=>!allowed.has(id))) return Response.json({error:'Invalid group selection'},{status:403});
      }
      const updated=await svc.entities.SavedPlace.update(place_id,{
        ...(place||{}),lat:Number(place?.lat??current.lat),lng:Number(place?.lng??current.lng),
        radius_m:Math.max(5,Math.min(Number(place?.radius_m??current.radius_m),100)),group_ids:groupIds
      });
      return Response.json({place:updated});
    }

    if(action==='delete'){
      if(!place_id) return Response.json({error:'Missing place_id'},{status:400});
      const current=await svc.entities.SavedPlace.get(place_id);
      if(!current || current.created_by_id!==me.id) return Response.json({error:'Not found'},{status:404});
      await svc.entities.SavedPlace.delete(place_id);
      return Response.json({ok:true});
    }

    if(action==='check'){
      if(lat==null || lng==null) return Response.json({error:'Missing location'},{status:400});
      const transitions=await runGeofenceCheck(svc,me.id,me,Number(lat),Number(lng));
      return Response.json({transitions});
    }

    return Response.json({error:'Invalid action'},{status:400});
  } catch(error) {
    console.error('saved-place-geofence error',error);
    if(isRateLimit(error)) return Response.json({error:'Server is busy. Please try again in a moment.'},{status:503});
    return Response.json({error:error?.message||'Server error'},{status:500});
  }
});