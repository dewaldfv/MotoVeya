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

const CATEGORIES = ['fuel','food','pub','workshop','dealership','emergency','rest_stop','scenic'];
const blankPoi = { name:'', brand:'', category:'fuel', lat:'', lng:'', description:'', phone:'', website:'', email:'', address:'', town:'', province:'', opening_hours:'', rating:'', photo_url:'', marker_id:'', is_open_24h:false, is_active:true, is_featured:false };
const blankMarker = { name:'', brand:'', category:'fuel', image_url:'', image_data:'', width_px:44, height_px:44, anchor_x:22, anchor_y:22, active:true, notes:'' };

function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) return reject(new Error('Please select an image file.'));
    if (file.size > 2 * 1024 * 1024) return reject(new Error('Marker images must be 2 MB or smaller.'));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
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
  const [pois,setPois]=useState([]); const [markers,setMarkers]=useState([]); const [loading,setLoading]=useState(true);
  const [poiForm,setPoiForm]=useState(blankPoi); const [markerForm,setMarkerForm]=useState(blankMarker);
  const [editingPoi,setEditingPoi]=useState(null); const [editingMarker,setEditingMarker]=useState(null);
  const [saving,setSaving]=useState(false); const [csvText,setCsvText]=useState('');

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
  const removePoi=async(id)=>{if(!confirm('Delete this POI?'))return;try{await base44.entities.POI.delete(id);toast.success('POI deleted');load();}catch(e){toast.error('Could not delete POI');}};
  const removeMarker=async(id)=>{if(!confirm('Delete this marker? POIs using it will fall back to their category marker.'))return;try{await base44.entities.POIMarker.delete(id);toast.success('Marker deleted');load();}catch(e){toast.error('Could not delete marker');}};
  const importCsv=async()=>{const rows=parseCsv(csvText);if(!rows.length){toast.error('No CSV rows found');return;}const valid=rows.map(r=>({...r,lat:Number(r.lat),lng:Number(r.lng),rating:r.rating?Number(r.rating):undefined,is_open_24h:String(r.is_open_24h).toLowerCase()==='true',is_active:r.is_active===''?true:String(r.is_active).toLowerCase()!=='false',is_featured:String(r.is_featured).toLowerCase()==='true'})).filter(r=>r.name&&r.category&&Number.isFinite(r.lat)&&Number.isFinite(r.lng));if(!valid.length){toast.error('No valid POIs in CSV');return;}try{for(let i=0;i<valid.length;i+=100)await base44.entities.POI.bulkCreate(valid.slice(i,i+100));toast.success(`${valid.length} POIs imported`);setCsvText('');load();}catch(e){console.error(e);toast.error('CSV import failed');}};

  return <div className="mt-5 rounded-2xl border bg-card p-3 sm:p-5">
    <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">POI & Map Marker Manager</h2><p className="text-sm text-muted-foreground">Create rider-facing POIs, upload reusable custom markers and bulk import locations.</p></div><Badge variant="secondary">Admin only</Badge></div>
    <Tabs defaultValue="pois">
      <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="pois">POIs ({pois.length})</TabsTrigger><TabsTrigger value="markers">Marker Library ({markers.length})</TabsTrigger><TabsTrigger value="import">Bulk Import</TabsTrigger></TabsList>
      <TabsContent value="pois" className="space-y-4 pt-4">
        <div className="grid gap-3 md:grid-cols-2">
          {['name','brand','lat','lng','address','town','province','phone','website','email','opening_hours','rating','photo_url'].map(k=><div key={k}><Label>{k.replace(/_/g,' ')}</Label><Input value={poiForm[k]??''} onChange={e=>setPoi(k,e.target.value)} placeholder={k==='lat'?'e.g. -28.2554817':k==='lng'?'e.g. 29.1156999':''}/></div>)}
          <div><Label>Category</Label><Select value={poiForm.category} onValueChange={v=>setPoi('category',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{CATEGORIES.map(c=><SelectItem key={c} value={c}>{c.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Custom Map Marker</Label><Select value={poiForm.marker_id || 'none'} onValueChange={v=>setPoi('marker_id',v==='none'?'':v)}><SelectTrigger><SelectValue placeholder="Category default"/></SelectTrigger><SelectContent><SelectItem value="none">Category default</SelectItem>{markers.filter(m=>m.active).map(m=><SelectItem key={m.id} value={m.id}>{m.name}{m.brand?` — ${m.brand}`:''}</SelectItem>)}</SelectContent></Select></div>
          <div className="md:col-span-2"><Label>Description</Label><Textarea value={poiForm.description} onChange={e=>setPoi('description',e.target.value)} /></div>
          <div className="flex items-center gap-2"><Switch checked={poiForm.is_open_24h} onCheckedChange={v=>setPoi('is_open_24h',v)}/><Label>Open 24 hours</Label></div><div className="flex items-center gap-2"><Switch checked={poiForm.is_active} onCheckedChange={v=>setPoi('is_active',v)}/><Label>Active on map</Label></div><div className="flex items-center gap-2"><Switch checked={poiForm.is_featured} onCheckedChange={v=>setPoi('is_featured',v)}/><Label>Featured</Label></div>
        </div>
        <div className="flex gap-2"><Button onClick={savePoi} disabled={saving}>{editingPoi?<Pencil size={16} className="mr-1"/>:<Plus size={16} className="mr-1"/>}{editingPoi?'Update POI':'Add POI'}</Button>{editingPoi&&<Button variant="ghost" onClick={()=>{setEditingPoi(null);setPoiForm(blankPoi)}}>Cancel</Button>}</div>
        <div className="space-y-2">{loading?<p className="text-sm text-muted-foreground">Loading…</p>:pois.map(p=><div key={p.id} className="flex items-center gap-3 rounded-xl border p-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary"><MapPin size={18}/></div><div className="min-w-0 flex-1"><p className="font-semibold truncate">{p.name}{p.brand?` · ${p.brand}`:''}</p><p className="text-xs text-muted-foreground">{p.category} · {p.lat}, {p.lng}{p.marker_id&&markerMap.has(p.marker_id)?' · Custom marker':''}</p></div><Button size="icon" variant="ghost" onClick={()=>{setEditingPoi(p);setPoiForm({...blankPoi,...p,lat:String(p.lat),lng:String(p.lng),rating:p.rating??''})}}><Pencil size={16}/></Button><Button size="icon" variant="ghost" onClick={()=>removePoi(p.id)}><Trash2 size={16}/></Button></div>)}</div>
      </TabsContent>
      <TabsContent value="markers" className="space-y-4 pt-4">
        <div className="grid gap-3 md:grid-cols-2"><div><Label>Marker Name</Label><Input value={markerForm.name} onChange={e=>setMarker('name',e.target.value)} placeholder="Engen Original"/></div><div><Label>Brand</Label><Input value={markerForm.brand} onChange={e=>setMarker('brand',e.target.value)} placeholder="Engen"/></div><div><Label>Category</Label><Select value={markerForm.category} onValueChange={v=>setMarker('category',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{CATEGORIES.map(c=><SelectItem key={c} value={c}>{c.replace('_',' ')}</SelectItem>)}</SelectContent></Select></div><div><Label>Image URL (optional)</Label><Input value={markerForm.image_url} onChange={e=>setMarker('image_url',e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Upload Marker Image</Label><Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={async e=>{try{const data=await readImage(e.target.files?.[0]);setMarker('image_data',data);toast.success('Marker image loaded')}catch(err){toast.error(err.message)}}}/><p className="mt-1 text-xs text-muted-foreground">The browser stores the exact image MIME type in the data URI. PNG/JPEG/WebP/SVG supported, max 2 MB.</p></div>
          {(markerForm.image_data||markerForm.image_url)&&<div className="flex items-center gap-3 rounded-xl border p-3 md:col-span-2"><img src={markerForm.image_data||markerForm.image_url} alt="Marker preview" className="h-14 w-14 object-contain"/><span className="text-sm text-muted-foreground">Preview</span></div>}
          <div><Label>Width px</Label><Input type="number" value={markerForm.width_px} onChange={e=>setMarker('width_px',e.target.value)}/></div><div><Label>Height px</Label><Input type="number" value={markerForm.height_px} onChange={e=>setMarker('height_px',e.target.value)}/></div><div><Label>Anchor X</Label><Input type="number" value={markerForm.anchor_x} onChange={e=>setMarker('anchor_x',e.target.value)}/></div><div><Label>Anchor Y</Label><Input type="number" value={markerForm.anchor_y} onChange={e=>setMarker('anchor_y',e.target.value)}/></div><div className="md:col-span-2"><Label>Notes</Label><Textarea value={markerForm.notes} onChange={e=>setMarker('notes',e.target.value)}/></div><div className="flex items-center gap-2"><Switch checked={markerForm.active} onCheckedChange={v=>setMarker('active',v)}/><Label>Active</Label></div>
        </div>
        <div className="flex gap-2"><Button onClick={saveMarker} disabled={saving}><Upload size={16} className="mr-1"/>{editingMarker?'Update Marker':'Add Marker'}</Button>{editingMarker&&<Button variant="ghost" onClick={()=>{setEditingMarker(null);setMarkerForm(blankMarker)}}>Cancel</Button>}</div>
        <div className="grid gap-2 md:grid-cols-2">{markers.map(m=><div key={m.id} className="flex items-center gap-3 rounded-xl border p-3"><div className="flex h-14 w-14 items-center justify-center rounded-lg bg-secondary"><img src={m.image_data||m.image_url} alt={m.name} className="max-h-12 max-w-12 object-contain"/></div><div className="min-w-0 flex-1"><p className="font-semibold truncate">{m.name}</p><p className="text-xs text-muted-foreground">{m.brand||'—'} · {m.category} · {m.width_px}×{m.height_px}</p></div><Button size="icon" variant="ghost" onClick={()=>{setEditingMarker(m);setMarkerForm({...blankMarker,...m})}}><Pencil size={16}/></Button><Button size="icon" variant="ghost" onClick={()=>removeMarker(m.id)}><Trash2 size={16}/></Button></div>)}</div>
      </TabsContent>
      <TabsContent value="import" className="space-y-3 pt-4"><div className="rounded-xl border border-dashed p-4"><div className="mb-2 flex items-center gap-2 font-semibold"><FileUp size={18}/> CSV POI Import</div><p className="mb-3 text-xs text-muted-foreground">Headers: name, brand, category, lat, lng, description, phone, website, email, address, town, province, opening_hours, rating, photo_url, marker_id, is_open_24h, is_active, is_featured</p><Textarea value={csvText} onChange={e=>setCsvText(e.target.value)} placeholder="name,brand,category,lat,lng,marker_id\nEngen,Harrismith,fuel,-28.2554817,29.1156999,MARKER_ID" className="min-h-40 font-mono text-xs"/><div className="mt-3 flex gap-2"><Button onClick={importCsv}><FileUp size={16} className="mr-1"/> Import CSV</Button><Button variant="ghost" onClick={()=>setCsvText('')}>Clear</Button></div></div></TabsContent>
    </Tabs>
  </div>;
}
