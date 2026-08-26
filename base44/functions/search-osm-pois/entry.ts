import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SELECTORS: Record<string,string> = {
  accommodation: 'nwr[tourism~"hotel|guest_house|hostel|motel|camp_site"]',
  hospital: 'nwr[amenity=hospital]',
  atm: 'nwr[amenity=atm]',
  fuel: 'nwr[amenity=fuel]',
  food: 'nwr[amenity~"restaurant|cafe|fast_food|food_court"]',
  pub: 'nwr[amenity~"pub|bar"]',
  dealership: 'nwr[shop=motorcycle]',
  workshop: 'nwr[shop=motorcycle_repair]',
  scenic: 'nwr[tourism~"viewpoint|picnic_site"]',
};

function name(tags:any) { return tags?.name || tags?.['name:en'] || tags?.brand || tags?.operator || 'Unnamed place'; }
export default async function(req:Request) {
  try {
    const base44=createClientFromRequest(req); if(!(await base44.auth.me())) return Response.json({error:'Unauthorized'},{status:401});
    const b=await req.json().catch(()=>({})); const lat=Number(b.lat),lng=Number(b.lng),radius=Math.min(Math.max(Number(b.radius||15000),1000),25000),category=String(b.category||'');
    const selector=SELECTORS[category]; if(!selector||!Number.isFinite(lat)||!Number.isFinite(lng)) return Response.json({pois:[]});
    const q=`[out:json][timeout:20];${selector}(around:${radius},${lat},${lng});out center tags;`;
    const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8','User-Agent':'MotoVeya/1.0 OSM POI search'},body:q});
    if(!r.ok) throw new Error(`Overpass ${r.status}`); const data=await r.json();
    const pois=(data.elements||[]).map((e:any)=>{const p=e.lat!=null?[e.lat,e.lon]:[e.center?.lat,e.center?.lon];const t=e.tags||{};if(p[0]==null||p[1]==null)return null;return{id:`osm-${e.type}-${e.id}`,name:name(t),lat:Number(p[0]),lng:Number(p[1]),category,address:[t['addr:housenumber'],t['addr:street'],t['addr:suburb'],t['addr:city']].filter(Boolean).join(', '),town:t['addr:city']||t['addr:town']||t['addr:village']||null,province:t['addr:province']||t['addr:state']||null,brand:t.brand||null,operator:t.operator||null,phone:t.phone||t['contact:phone']||null,website:t.website||t['contact:website']||null,opening_hours:t.opening_hours||null,is_open_24h:t.opening_hours==='24/7',description:t.description||t['description:en']||null,source:'openstreetmap',source_id:`${e.type}/${e.id}`,source_url:`https://www.openstreetmap.org/${e.type}/${e.id}`,source_updated_at:t.check_date||t['survey:date']||null};}).filter(Boolean).slice(0,100);
    return Response.json({pois});
  }catch(e){console.error('search-osm-pois',e);return Response.json({pois:[],error:'OSM search unavailable'},{status:200});}
}
