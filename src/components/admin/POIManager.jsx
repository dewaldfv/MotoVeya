import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MapPin, Upload, Trash2, Pencil, Plus, Image as ImageIcon, FileUp } from 'lucide-react';

const CATEGORIES = ['maintenance_repair','tyres_wheels','batteries','oil_lubricants','spare_parts','dealerships','riding_gear','custom_paint','custom_builders','performance_tuning','electrical','suspension','chains_sprockets','detailing','transport','roadside_assist','training_schools','photography','food_restaurant','food_pub_bar','food_cafe','food_fast_food','food_breakfast','food_bakery','food_market'];
const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(c=>[c,c.replace(/_/g,' ')]));
const blankPoi = { name:'', brand:'', category:'maintenance_repair', lat:'', lng:'', description:'', phone:'', website:'', email:'', address:'', town:'', province:'', opening_hours:'', rating:'', marker_id:'', is_open_24h:false, is_active:true, is_featured:false };
const blankMarker = { name:'', brand:'', category:'maintenance_repair', image_url:'', image_data:'', width_px:44, height_px:44, anchor_x:22, anchor_y:22, active:true, notes:'' };

function validateMarkerFile(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Please select an image file.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Marker images must be 2 MB or smaller.');
  return file;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the marker image.'));
    reader.readAsDataURL(file);
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i=0;i<text.length;i++) {
    const c=text[i], n=text[i+1];
    if (c==='"' && quoted && n==='"') { cell+='"'; i++; continue; }
    if (c==='"') { quoted=!quoted; continue; }
    if (c===',' && !quoted) { row.push(cell.trim()); cell=''; continue; }
    if ((c==='\n' || c==='\r') && !quoted) { if (c==='\r' && n==='\n') i++; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row=[]; cell=''; continue; }
    cell+=c;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  if (!rows.length) return [];
  const headers=rows[0].map(h=>h.toLowerCase().replace(/\s+/g,'_'));
  return rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i] ?? ''])));
}

export default function POIManager() {
  const [pois,setPois]=useState([]); const [markers,setMarkers]=useState([]); const [loading,setLoading]=useState(true); const [poiCategoryFilter,setPoiCategoryFilter]=useState('all');
  const [poiForm,setPoiForm]=useState(blankPoi); const [markerForm,setMarkerForm]=useState(blankMarker);
  const [editingPoi,setEditingPoi]=useState(null); const [editingMarker,setEditingMarker]=useState(null);
  const [saving,setSaving]=useState(false); const [csvText,setCsvText]=useState(''); const [syncing,setSyncing]=useState(false); const [syncProgress,setSyncProgress]=useState('');

  const load=async()=>{ setLoading(true); try { const [p,m]=await Promise.all([base44.entities.POI.list('-created_date',500),base44.entities.POIMarker.list('-created_date',500)]); setPois(p||[]); setMarkers(m||[]); } catch(e){ console.error(e); toast.error('Could not load POI data'); } finally{setLoading(false);} };
  useEffect(()=>{load();},[]);

  const markerMap=useMemo(()=>new Map(markers.map(m=>[m.id,m])),[markers]);
  const setPoi=(k,v)=>setPoiForm(x=>({...x,[k]:v})); const setMarker=(k,v)=>setMarkerForm(x=>({...x,[k]:v}));

  const savePoi=async()=>{
    if(!poiForm.name || !poiForm.lat || !poiForm.lng){toast.error('Name, latitude and longitude are required');return;}
    setSaving(true); try { const payload={...poiForm,lat:Number(poiForm.lat),lng:Number(poiForm.lng),rating:poiForm.rating===''?undefined:Number(poiForm.rating)}; if(editingPoi) await base44.entities.POI.update(editingPoi.id,payload); else await base44.entities.POI.create(payload); toast.success(editingPoi?'POI updated':'POI created'); setPoiForm(blankPoi); setEditingPoi(null); await load(); } catch(e){console.error(e);toast.error('Could not save POI');} finally{setSaving(false);} };
  const saveMarker=async()=>{
    if(!markerForm.name){toast.error('Marker name is required');return;}
    if(!markerForm.image_data && !markerForm.image_url){toast.error('Upload a marker image or provide an image URL');return;}
    setSaving(true); try { const payload={...markerForm,width_px:Number(markerForm.width_px)||44,height_px:Number(markerForm.height_px)||44,anchor_x:Number(markerForm.anchor_x)||22,anchor_y:Number(markerForm.anchor_y)||22}; if(editingMarker) await base44.entities.POIMarker.update(editingMarker.id,payload); else await base44.entities.POIMarker.create(payload); toast.success(editingMarker?'Marker updated':'Marker added'); setMarkerForm(blankMarker); setEditingMarker(null); await load(); } catch(e){console.error(e);toast.error('Could not save marker');} finally{setSaving(false);} };
  const uploadMarkerFile=async(file)=>{
    try {
      validateMarkerFile(file);
      setSaving(true);
      const dataUrl = await fileToDataUrl(file);
      setMarker('image_data', dataUrl);
      setMarker('image_url', '');
      toast.success('Custom marker loaded — click Add Marker to save it');
    } catch(e) {
      console.error(e);
      toast.error(e.message || 'Could not load marker');
    } finally { setSaving(false); }
  };
  const removePoi=async(id)=>{if(!confirm('Delete this POI?'))return;try{await base44.entities.POI.delete(id);toast.success('POI deleted');load();}catch(e){toast.error('Could not delete POI');}};
  const removeMarker=async(id)=>{if(!confirm('Delete this marker? POIs using it will fall back to their category marker.'))return;try{await base44.entities.POIMarker.delete(id);toast.success('Marker deleted');load();}catch(e){toast.error('Could not delete marker');}};
  const assignMarkerToBrand=async(marker)=>{if(!marker.brand){toast.error('Add a brand to the marker first');return;}if(!confirm(`Assign ${marker.name} to every POI with brand ${marker.brand}?`))return;try{const matches=await base44.entities.POI.filter({brand:marker.brand},'-created_date',500);if(!matches?.length){toast.info(`No POIs found for brand ${marker.brand}`);return;}for(let i=0;i<matches.length;i+=100){await Promise.all(matches.slice(i,i+100).map(p=>base44.entities.POI.update(p.id,{marker_id:marker.id})));}toast.success(`${matches.length} ${marker.brand} POIs updated`);load();}catch(e){console.error(e);toast.error('Could not assign marker to brand');}};
  const syncFromOSM=async()=>{
    if(!confirm('Sync rider-relevant POIs for South Africa from OpenStreetMap? This can return a large dataset and may take several minutes.')) return;
    setSyncing(true); setSyncProgress('Querying OpenStreetMap…');
    try {
      const query=`[out:json][timeout:180];(nwr["amenity"~"fuel|restaurant|fast_food|cafe|pub|bar|bicycle_parking|marketplace|hospital|clinic|police|fire_station"](-35.2,16.4,-22.0,33.0);nwr["shop"~"motorcycle|motorcycle_parts|tyres|car_repair|bicycle|clothes|sports"](-35.2,16.4,-22.0,33.0);nwr["craft"~"car_repair|electrician"](-35.2,16.4,-22.0,33.0);nwr["tourism"~"hotel|motel|camp_site|attraction"](-35.2,16.4,-22.0,33.0);nwr["leisure"~"sports_centre|track|pitch"](-35.2,16.4,-22.0,33.0);nwr["highway"="rest_area"](-35.2,16.4,-22.0,33.0););out center tags;`;
      const res=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'MotoVeya/1.0 POI sync'},body:new URLSearchParams({data:query})});
      if(!res.ok) throw new Error(`Overpass returned HTTP ${res.status}`);
      const data=await res.json(); const elements=data.elements||[]; setSyncProgress(`Classifying ${elements.length.toLocaleString()} OSM places…`);
      const mapCategory=(t)=>{const a=t.amenity,s=t.shop,c=t.craft,to=t.tourism,l=t.leisure,h=t.highway;
        if(a==='fuel') return 'transport'; if(a==='restaurant') return 'food_restaurant'; if(a==='pub'||a==='bar') return 'food_pub_bar'; if(a==='cafe') return 'food_cafe'; if(a==='fast_food') return 'food_fast_food'; if(a==='marketplace') return 'food_market'; if(a==='hospital'||a==='clinic') return 'roadside_assist'; if(a==='police'||a==='fire_station') return 'roadside_assist';
        if(s==='motorcycle') return 'dealerships'; if(s==='motorcycle_parts') return 'spare_parts'; if(s==='tyres') return 'tyres_wheels'; if(s==='clothes') return 'riding_gear'; if(s==='car_repair') return 'maintenance_repair'; if(c==='car_repair') return 'maintenance_repair'; if(c==='electrician') return 'electrical'; if(to==='hotel'||to==='motel'||to==='camp_site') return 'transport'; if(to==='attraction'||l==='track') return 'photography'; if(h==='rest_area') return 'transport'; return null;};
      const seen=new Set(); const valid=elements.map(e=>{const t=e.tags||{}; const category=mapCategory(t); const lat=e.lat??e.center?.lat,lng=e.lon??e.center?.lon; if(!category||!t.name||lat==null||lng==null)return null; const osm_id=`${e.type}/${e.id}`; if(seen.has(osm_id))return null; seen.add(osm_id); return {name:t.name,brand:t.brand||t.operator||'',category,lat:Number(lat),lng:Number(lng),description:t.description||'',phone:t.phone||t['contact:phone']||'',website:t.website||t['contact:website']||'',email:t.email||t['contact:email']||'',address:t['addr:street']||'',town:t['addr:city']||t['addr:town']||t['addr:suburb']||'',province:t['addr:state']||'',opening_hours:t.opening_hours||'',is_open_24h:t.opening_hours==='24/7',is_active:true,is_featured:false,osm_id,osm_type:e.type,source:'OpenStreetMap',source_url:`https://www.openstreetmap.org/${e.type}/${e.id}`,needs_review:true};}).filter(Boolean);
      setSyncProgress(`Checking ${valid.length.toLocaleString()} relevant POIs…`);
      let existing=[]; try{existing=await base44.entities.POI.filter({source:'OpenStreetMap'},'-created_date',500)||[];}catch{}
      const existingIds=new Set(existing.map(p=>p.osm_id).filter(Boolean)); const fresh=valid.filter(p=>!existingIds.has(p.osm_id));
      for(let i=0;i<fresh.length;i+=100){setSyncProgress(`Saving ${Math.min(i+100,fresh.length).toLocaleString()} / ${fresh.length.toLocaleString()}…`); await base44.entities.POI.bulkCreate(fresh.slice(i,i+100));}
      toast.success(`OSM sync complete: ${fresh.length.toLocaleString()} new POIs added; ${valid.length-fresh.length} already existed.`); await load();
    } catch(e){console.error(e); toast.error(`OSM sync failed: ${e.message||'unknown error'}`);} finally{setSyncing(false);setSyncProgress('');}
  };
  const importCsv=async()=>{const rows=parseCsv(csvText);if(!rows.length){toast.error('No CSV rows found');return;}const valid=rows.map(r=>({...r,lat:Number(r.lat),lng:Number(r.lng),rating:r.rating?Number(r.rating):undefined,is_open_24h:String(r.is_open_24h).toLowerCase()==='true',is_active:r.is_active===''?true:String(r.is_active).toLowerCase()!=='false',is_featured:String(r.is_featured).toLowerCase()==='true'})).filter(r=>r.name&&r.category&&Number.isFinite(r.lat)&&Number.isFinite(r.lng));if(!valid.length){toast.error('No valid POIs in CSV');return;}try{for(let i=0;i<valid.length;i+=100)await base44.entities.POI.bulkCreate(valid.slice(i,i+100));toast.success(`${valid.length} POIs imported`);setCsvText('');load();}catch(e){console.error(e);toast.error('CSV import failed');}};

  return <div className="mt-5 rounded-2xl border bg-card p-3 sm:p-5">
    <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">POI & Map Marker Manager</h2><p className="text-sm text-muted-foreground">Create rider-facing POIs, upload reusable custom markers and bulk import locations.</p></div><Badge variant="secondary">Admin only</Badge></div>
    <Tabs defaultValue="pois">
      <TabsList className="grid w-full grid-cols-4"><TabsTrigger value="pois">POIs ({pois.length})</TabsTrigger><TabsTrigger value="markers">Marker Library ({markers.length})</TabsTrigger><TabsTrigger value="sync">OSM Sync</TabsTrigger><TabsTrigger value="import">Bulk Import</TabsTrigger></TabsList>
      <TabsContent value="pois" className="space-y-4 pt-4">
        <div className="rounded-xl border bg-background/50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2"><Label>POI Category</Label><Badge variant="secondary">{poiCategoryFilter === 'all' ? pois.length : pois.filter(p=>p.category===poiCategoryFilter).length} POIs</Badge></div>
          <Select value={poiCategoryFilter} onValueChange={setPoiCategoryFilter}><SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{CATEGORIES.map(c=><SelectItem key={c} value={c}>{CATEGORY_LABELS[c]||c}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {['name','brand','lat','lng','address','town','province','phone','website','email','opening_hours','rating'].map(k=><div key={k}><Label>{k.replace(/_/g,' ')}</Label><Input value={poiForm[k]??''} onChange={e=>setPoi(k,e.target.value)} placeholder={k==='lat'?'e.g. -28.2554817':k==='lng'?'e.g. 29.1156999':''}/></div>)}
          <div><Label>Category</Label><Select value={poiForm.category} onValueChange={v=>setPoi('category',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{CATEGORIES.map(c=><SelectItem key={c} value={c}>{CATEGORY_LABELS[c]||c}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Upload Custom Map Marker</Label><Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{validateMarkerFile(file);setSaving(true);const dataUrl=await fileToDataUrl(file);const marker=await base44.entities.POIMarker.create({name:`${poiForm.name || 'POI'} Marker`,brand:poiForm.brand||'',category:poiForm.category,image_data:dataUrl,image_url:'',width_px:44,height_px:44,anchor_x:22,anchor_y:22,active:true});setPoi('marker_id',marker.id);setMarkers(x=>[marker,...x]);toast.success('Custom map marker added and assigned to this POI');}catch(err){console.error(err);toast.error(err.message||'Could not add custom map marker');}finally{setSaving(false);e.target.value='';}}}/><p className="mt-1 text-xs text-muted-foreground">PNG, JPEG, WebP or SVG · maximum 2 MB. The marker is saved directly with MotoVeya.</p></div>
          <div className="md:col-span-2"><Label>Description</Label><Textarea value={poiForm.description} onChange={e=>setPoi('description',e.target.value)} /></div>
          <div className="flex items-center gap-2"><Switch checked={poiForm.is_open_24h} onCheckedChange={v=>setPoi('is_open_24h',v)}/><Label>Open 24 hours</Label></div><div className="flex items-center gap-2"><Switch checked={poiForm.is_active} onCheckedChange={v=>setPoi('is_active',v)}/><Label>Active on map</Label></div><div className="flex items-center gap-2"><Switch checked={poiForm.is_featured} onCheckedChange={v=>setPoi('is_featured',v)}/><Label>Featured</Label></div>
        </div>
        <div className="flex gap-2"><Button onClick={savePoi} disabled={saving}>{editingPoi?<Pencil size={16} className="mr-1"/>:<Plus size={16} className="mr-1"/>}{editingPoi?'Update POI':'Add POI'}</Button>{editingPoi&&<Button variant="ghost" onClick={()=>{setEditingPoi(null);setPoiForm(blankPoi)}}>Cancel</Button>}</div>
        <div className="space-y-4">{loading?<p className="text-sm text-muted-foreground">Loading…</p>:CATEGORIES.filter(category=>poiCategoryFilter==='all'||category===poiCategoryFilter).map(category=>{const categoryPois=pois.filter(p=>p.category===category);if(!categoryPois.length)return null;return <div key={category} className="rounded-xl border p-3"><div className="mb-3 flex items-center justify-between"><div><h3 className="font-bold capitalize">{category.replace('_',' ')}</h3><p className="text-xs text-muted-foreground">{categoryPois.length} POI{categoryPois.length===1?'':'s'}</p></div><Badge variant="outline">{category}</Badge></div><div className="space-y-2">{categoryPois.map(p=><div key={p.id} className="flex items-center gap-3 rounded-xl bg-background p-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary"><MapPin size={18}/></div><div className="min-w-0 flex-1"><p className="font-semibold truncate">{p.name}{p.brand?` · ${p.brand}`:''}</p><p className="text-xs text-muted-foreground">{p.lat}, {p.lng}{p.marker_id&&markerMap.has(p.marker_id)?' · Custom marker':''}</p></div><Button size="icon" variant="ghost" onClick={()=>{setEditingPoi(p);setPoiForm({...blankPoi,...p,lat:String(p.lat),lng:String(p.lng),rating:p.rating??''})}}><Pencil size={16}/></Button><Button size="icon" variant="ghost" onClick={()=>removePoi(p.id)}><Trash2 size={16}/></Button></div>)}</div></div>})}</div>
      </TabsContent>
      <TabsContent value="markers" className="space-y-4 pt-4">
        <div className="grid gap-3 md:grid-cols-2"><div><Label>Marker Name</Label><Input value={markerForm.name} onChange={e=>setMarker('name',e.target.value)} placeholder="Engen Original"/></div><div><Label>Brand</Label><Input value={markerForm.brand} onChange={e=>setMarker('brand',e.target.value)} placeholder="Engen"/></div><div><Label>Category</Label><Select value={markerForm.category} onValueChange={v=>setMarker('category',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{CATEGORIES.map(c=><SelectItem key={c} value={c}>{CATEGORY_LABELS[c]||c}</SelectItem>)}</SelectContent></Select></div><div><Label>Image URL (optional)</Label><Input value={markerForm.image_url} onChange={e=>setMarker('image_url',e.target.value)} /></div>
          <div className="md:col-span-2 rounded-xl border border-dashed p-4"><Label>Custom Map Marker</Label><div className="mt-2 flex flex-wrap items-center gap-3"><Input id="marker-upload" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file) uploadMarkerFile(file);e.target.value='';}}/><Button type="button" variant="secondary" onClick={()=>document.getElementById('marker-upload')?.click()} disabled={saving}><Upload size={16} className="mr-2"/> Upload Custom Marker</Button>{markerForm.image_url&&<Badge variant="secondary">Uploaded</Badge>}</div><p className="mt-2 text-xs text-muted-foreground">PNG, JPEG, WebP or SVG · maximum 2 MB. The original uploaded file is stored and used as the map marker without generating a replacement image.</p></div>
          {(markerForm.image_data||markerForm.image_url)&&<div className="flex items-center gap-3 rounded-xl border p-3 md:col-span-2"><img src={markerForm.image_data||markerForm.image_url} alt="Marker preview" className="h-14 w-14 object-contain"/><div className="flex-1"><p className="text-sm font-semibold">Marker preview</p><p className="text-xs text-muted-foreground">Ready to save. Click Add Marker below.</p></div></div>}
          <div><Label>Width px</Label><Input type="number" value={markerForm.width_px} onChange={e=>setMarker('width_px',e.target.value)}/></div><div><Label>Height px</Label><Input type="number" value={markerForm.height_px} onChange={e=>setMarker('height_px',e.target.value)}/></div><div><Label>Anchor X</Label><Input type="number" value={markerForm.anchor_x} onChange={e=>setMarker('anchor_x',e.target.value)}/></div><div><Label>Anchor Y</Label><Input type="number" value={markerForm.anchor_y} onChange={e=>setMarker('anchor_y',e.target.value)}/></div><div className="md:col-span-2"><Label>Notes</Label><Textarea value={markerForm.notes} onChange={e=>setMarker('notes',e.target.value)}/></div><div className="flex items-center gap-2"><Switch checked={markerForm.active} onCheckedChange={v=>setMarker('active',v)}/><Label>Active</Label></div>
        </div>
        <div className="flex gap-2"><Button onClick={saveMarker} disabled={saving}><Upload size={16} className="mr-1"/>{editingMarker?'Update Marker':'Add Marker'}</Button>{editingMarker&&<Button variant="ghost" onClick={()=>{setEditingMarker(null);setMarkerForm(blankMarker)}}>Cancel</Button>}</div>
        <div className="space-y-4">{CATEGORIES.map(category=>{const categoryMarkers=markers.filter(m=>m.category===category);if(!categoryMarkers.length)return null;return <div key={category} className="rounded-xl border p-3"><div className="mb-3 flex items-center justify-between"><h3 className="font-bold capitalize">{category.replace('_',' ')}</h3><Badge variant="outline">{categoryMarkers.length}</Badge></div><div className="grid gap-2 md:grid-cols-2">{categoryMarkers.map(m=><div key={m.id} className="rounded-xl border p-3"><div className="flex items-center gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-lg bg-secondary"><img src={m.image_data||m.image_url} alt={m.name} className="max-h-12 max-w-12 object-contain"/></div><div className="min-w-0 flex-1"><p className="font-semibold truncate">{m.name}</p><p className="text-xs text-muted-foreground">{m.brand||'—'} · {m.category} · {m.width_px}×{m.height_px}</p></div><Button size="icon" variant="ghost" onClick={()=>{setEditingMarker(m);setMarkerForm({...blankMarker,...m})}}><Pencil size={16}/></Button><Button size="icon" variant="ghost" onClick={()=>removeMarker(m.id)}><Trash2 size={16}/></Button></div>{m.brand&&<Button size="sm" variant="secondary" className="mt-2 w-full" onClick={()=>assignMarkerToBrand(m)}>Apply to all {m.brand} POIs</Button>}</div>)}</div></div>})}</div>
      </TabsContent>
      <TabsContent value="sync" className="space-y-4 pt-4"><div className="rounded-xl border p-4"><h3 className="font-bold">OpenStreetMap POI Sync</h3><p className="mt-1 text-sm text-muted-foreground">Discover rider-relevant South African POIs from OpenStreetMap and add them to MotoVeya automatically. Imported records are marked as OpenStreetMap-sourced and flagged for admin review.</p><div className="mt-4 flex flex-wrap items-center gap-3"><Button onClick={syncFromOSM} disabled={syncing}><MapPin size={16} className="mr-2"/>{syncing?'Syncing…':'Sync South Africa from OSM'}</Button>{syncing&&<Badge variant="secondary">{syncProgress}</Badge>}</div><p className="mt-3 text-xs text-muted-foreground">Uses the Overpass API for selected POI data; Nominatim is not used for bulk discovery. Review imported POIs before relying on them as verified business information.</p></div></TabsContent>
      <TabsContent value="import" className="space-y-3 pt-4"><div className="rounded-xl border border-dashed p-4"><div className="mb-2 flex items-center gap-2 font-semibold"><FileUp size={18}/> CSV POI Import</div><p className="mb-3 text-xs text-muted-foreground">Headers: name, brand, category, lat, lng, description, phone, website, email, address, town, province, opening_hours, rating, photo_url, marker_id, is_open_24h, is_active, is_featured</p><Textarea value={csvText} onChange={e=>setCsvText(e.target.value)} placeholder="name,brand,category,lat,lng,marker_id\nEngen,Harrismith,fuel,-28.2554817,29.1156999,MARKER_ID" className="min-h-40 font-mono text-xs"/><div className="mt-3 flex gap-2"><Button onClick={importCsv}><FileUp size={16} className="mr-1"/> Import CSV</Button><Button variant="ghost" onClick={()=>setCsvText('')}>Clear</Button></div></div></TabsContent>
    </Tabs>
  </div>;
}
