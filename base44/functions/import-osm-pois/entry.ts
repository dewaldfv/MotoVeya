import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const TAG_QUERIES = [
  ['fuel', 'nwr[amenity=fuel]'],
  ['food', 'nwr[amenity~"restaurant|cafe|fast_food|food_court"]'],
  ['pub', 'nwr[amenity~"pub|bar"]'],
  ['dealership', 'nwr[shop=motorcycle]'],
  ['workshop', 'nwr[shop=motorcycle_repair]'],
  ['accommodation', 'nwr[tourism~"hotel|guest_house|hostel|motel|camp_site"]'],
  ['hospital', 'nwr[amenity=hospital]'],
  ['atm', 'nwr[amenity=atm]'],
  ['scenic', 'nwr[tourism~"viewpoint|picnic_site"]'],
];

function esc(s: string) { return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
function normalizeName(tags: any) { return tags?.name || tags?.['name:en'] || tags?.['brand'] || tags?.operator || 'Unnamed place'; }

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const lat = Number(body.lat), lng = Number(body.lng);
    const radius = Math.min(Math.max(Number(body.radius || 15000), 1000), 25000);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Response.json({ error: 'lat and lng required' }, { status: 400 });

    const clauses = TAG_QUERIES.map(([category, selector]) => `  ${selector}(around:${radius},${lat},${lng});`).join('\n');
    const query = `[out:json][timeout:35];(${clauses}\n);out center tags;`;
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': 'MotoVeya/1.0 OSM POI importer' }, body: query,
    });
    if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
    const data = await response.json();
    const categoryBySelector = TAG_QUERIES.map(([category, selector]) => [selector, category]);

    const imported: any[] = [];
    const seen = new Set<string>();
    for (const el of (data.elements || [])) {
      const p = el.lat != null ? [el.lat, el.lon] : [el.center?.lat, el.center?.lon];
      if (p[0] == null || p[1] == null) continue;
      const tags = el.tags || {};
      let category = 'food';
      if (tags.amenity === 'fuel') category = 'fuel';
      else if (['pub','bar'].includes(tags.amenity)) category = 'pub';
      else if (['restaurant','cafe','fast_food','food_court'].includes(tags.amenity)) category = 'food';
      else if (tags.shop === 'motorcycle') category = 'dealership';
      else if (tags.shop === 'motorcycle_repair') category = 'workshop';
      else if (['hotel','guest_house','hostel','motel','camp_site'].includes(tags.tourism)) category = 'accommodation';
      else if (tags.amenity === 'hospital') category = 'hospital';
      else if (tags.amenity === 'atm') category = 'atm';
      else if (['viewpoint','picnic_site'].includes(tags.tourism)) category = 'scenic';
      const key = `${category}:${el.type}:${el.id}`;
      if (seen.has(key)) continue; seen.add(key);
      const place = {
        name: normalizeName(tags), lat: Number(p[0]), lng: Number(p[1]), category,
        address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(', '),
        town: tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || null,
        province: tags['addr:province'] || tags['addr:state'] || null,
        brand: tags.brand || null,
        operator: tags.operator || null,
        phone: tags.phone || tags['contact:phone'] || null,
        website: tags.website || tags['contact:website'] || null,
        opening_hours: tags.opening_hours || null,
        is_open_24h: tags.opening_hours === '24/7',
        description: tags.description || tags['description:en'] || null,
        source: 'openstreetmap', source_id: `${el.type}/${el.id}`,
        source_url: `https://www.openstreetmap.org/${el.type}/${el.id}`, 
        source_updated_at: tags['check_date'] || tags['survey:date'] || null,
      };
      try {
        const existing = await base44.entities.POI.filter({ source: 'openstreetmap', source_id: place.source_id }, '-created_date', 1);
        if (existing?.length) { imported.push({ ...place, status: 'existing' }); continue; }
        await base44.entities.POI.create(place);
        imported.push({ ...place, status: 'created' });
      } catch (e) { console.error('POI create failed', e); }
    }
    return Response.json({ ok: true, count: imported.length, created: imported.filter(x => x.status === 'created').length, existing: imported.filter(x => x.status === 'existing').length, categories: [...new Set(imported.map(x => x.category))] });
  } catch (error) {
    console.error('import-osm-pois:', error);
    return Response.json({ error: 'OSM POI import failed', details: String(error?.message || error) }, { status: 500 });
  }
}
