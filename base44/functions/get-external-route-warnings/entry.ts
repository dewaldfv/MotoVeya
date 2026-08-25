import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function minDistanceToRoute(lat: number, lng: number, route: number[][]) {
  if (!route?.length) return Infinity;
  const step = Math.max(1, Math.floor(route.length / 300)); let min = Infinity;
  for (let i = 0; i < route.length; i += step) { const p = route[i]; if (Array.isArray(p) && p.length >= 2) min = Math.min(min, distanceKm(lat, lng, p[0], p[1])); }
  return min;
}
function parseTomTom(raw: any, meLat: number, meLng: number) {
  const items = raw?.incidents || raw?.results || raw?.tm?.results || [];
  return (Array.isArray(items) ? items : []).map((x: any) => {
    const c = x?.geometry?.coordinates || x?.point?.coordinates; if (!Array.isArray(c) || c.length < 2) return null;
    const lng = Number(c[0]), lat = Number(c[1]); if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const desc = x?.properties?.events?.[0]?.description || x?.properties?.description || x?.description || 'Traffic incident';
    return { id:`tomtom-${x.id || `${lat}-${lng}`}`, source:'TomTom', lat, lng, title:desc, message:desc, severity:String(x?.properties?.events?.[0]?.magnitudeOfDelay || x?.severity || 'unknown'), distance_from_rider_km:distanceKm(meLat,meLng,lat,lng) };
  }).filter(Boolean);
}
function parseHere(raw: any, meLat: number, meLng: number) {
  const items = raw?.results || raw?.incidents || [];
  return (Array.isArray(items) ? items : []).map((x:any) => {
    const p = x?.location?.shape?.links?.[0]?.points?.[0] || x?.location?.coordinates; if (!p) return null;
    const lat=Number(p.lat ?? p.latitude), lng=Number(p.lng ?? p.longitude); if (!Number.isFinite(lat)||!Number.isFinite(lng)) return null;
    const desc=x?.incidentDetails?.description?.value || x?.description || 'Traffic incident';
    return { id:`here-${x.id || `${lat}-${lng}`}`, source:'HERE', lat,lng,title:desc,message:desc,severity:x?.incidentDetails?.criticality || 'unknown',distance_from_rider_km:distanceKm(meLat,meLng,lat,lng) };
  }).filter(Boolean);
}
export default async function(req: Request) {
  try {
    const base44=createClientFromRequest(req); const me=await base44.auth.me(); if(!me) return Response.json({error:'Unauthorized'},{status:401});
    const body=await req.json().catch(()=>({})); const lat=Number(body.lat),lng=Number(body.lng),route=Array.isArray(body.route)?body.route:[];
    if(!Number.isFinite(lat)||!Number.isFinite(lng)) return Response.json({error:'lat and lng required'},{status:400});
    const warnings:any[]=[]; const tomtomKey=Deno.env.get('TOMTOM_API_KEY'),hereKey=Deno.env.get('HERE_API_KEY'); const jobs:Promise<void>[]=[];
    if(tomtomKey) jobs.push((async()=>{try{const d=.12;const u=`https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${lng-d},${lat-d},${lng+d},${lat+d}&fields={incidents{type,geometry{type,coordinates},properties{events{description,magnitudeOfDelay}}}}&language=en-GB&timeValidityFilter=present&key=${encodeURIComponent(tomtomKey)}`;const r=await fetch(u);if(r.ok)warnings.push(...parseTomTom(await r.json(),lat,lng));}catch(e){console.error('TomTom:',e);}})());
    if(hereKey) jobs.push((async()=>{try{const u=`https://data.traffic.hereapi.com/v7/incidents?in=circle:${lat},${lng};r=15000&locationReferencing=shape&apiKey=${encodeURIComponent(hereKey)}`;const r=await fetch(u);if(r.ok)warnings.push(...parseHere(await r.json(),lat,lng));}catch(e){console.error('HERE:',e);}})());
    await Promise.all(jobs);
    const relevant=warnings.filter(w=>route.length>=2?minDistanceToRoute(w.lat,w.lng,route)<=1.5:w.distance_from_rider_km<=15); const merged:any[]=[];
    for(const w of relevant){const existing=merged.find(m=>distanceKm(m.lat,m.lng,w.lat,w.lng)<=.5);if(existing){existing.sources=[...new Set([...(existing.sources||[existing.source]),w.source])];existing.confidence=existing.sources.length>1?'high':'medium';}else merged.push({...w,sources:[w.source],confidence:'medium'});}
    return Response.json({warnings:merged.sort((a,b)=>a.distance_from_rider_km-b.distance_from_rider_km),sources:{tomtom:!!tomtomKey,here:!!hereKey}});
  }catch(error){console.error('get-external-route-warnings:',error);return Response.json({error:'Unable to load external warnings'},{status:500});}
}
