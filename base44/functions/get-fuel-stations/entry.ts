import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const BRAND_ALIASES: Record<string,string> = {
  engen:'engen','engen petroleum':'engen',
  astron:'astron energy','astron energy':'astron energy',caltex:'astron energy',
  bp:'bp','bp south africa':'bp',petrosa:'petrosa',
  puma:'puma energy','puma energy':'puma energy',sasol:'sasol',shell:'shell',
  total:'totalenergies',totalenergies:'totalenergies','total energies':'totalenergies',
  prax:'prax',
};

function normalizeBrand(value: unknown) {
  const key = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return BRAND_ALIASES[key] || key || null;
}
function stationName(tags: any) {
  return tags?.name || tags?.brand || tags?.operator || 'Fuel Station';
}
function fuelTypes(tags: any) {
  const types: string[] = [];
  if (tags?.['fuel:octane_93']) types.push('93');
  if (tags?.['fuel:octane_95']) types.push('95');
  if (tags?.['fuel:diesel']) types.push('diesel');
  if (tags?.['fuel:lpg']) types.push('lpg');
  return types;
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await base44.auth.me())) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const lat = Number(body.lat), lng = Number(body.lng);
    const radius = Math.min(Math.max(Number(body.radius || 25000), 1000), 25000);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json({ stations: [], error: 'lat and lng are required' }, { status: 400 });
    }

    const query = `[out:json][timeout:30];nwr[amenity=fuel](around:${radius},${lat},${lng});out center tags;`;
    let data: any = null;
    for (const endpoint of ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': 'MotoVeya/1.0 fuel station map layer' },
          body: query,
        });
        if (!response.ok) throw new Error(`Overpass ${response.status}`);
        data = await response.json();
        break;
      } catch (error) {
        console.warn('Fuel station endpoint failed:', endpoint, error);
      }
    }
    if (!data) return Response.json({ stations: [], unavailable: true });

    let brands: any[] = [];
    try { brands = await base44.entities.FuelBrand.list('-name', 100); }
    catch (error) { console.warn('FuelBrand lookup failed:', error); }

    const brandByNormalized = new Map(
      brands.filter((b: any) => b?.active !== false)
        .map((b: any) => [String(b.normalized_name || b.name || '').toLowerCase().trim(), b])
    );

    const seen = new Set<string>();
    const stations = (data.elements || []).map((el: any) => {
      const p = el.lat != null ? [el.lat, el.lon] : [el.center?.lat, el.center?.lon];
      if (p[0] == null || p[1] == null) return null;
      const tags = el.tags || {};
      const sourceId = `${el.type}/${el.id}`;
      if (seen.has(sourceId)) return null;
      seen.add(sourceId);

      const normalized = normalizeBrand(tags.brand || tags.operator);
      const brandRecord = normalized ? brandByNormalized.get(normalized) : null;
      return {
        id: `fuel-${el.type}-${el.id}`,
        source_id: sourceId,
        name: stationName(tags),
        lat: Number(p[0]), lng: Number(p[1]),
        brand: brandRecord?.name || tags.brand || null,
        brand_id: brandRecord?.id || null,
        logo_url: brandRecord?.marker_logo_url || brandRecord?.logo_url || null,
        primary_colour: brandRecord?.primary_colour || null,
        operator: tags.operator || null,
        address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'],
          tags['addr:city'] || tags['addr:town'] || tags['addr:village']].filter(Boolean).join(', '),
        town: tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || null,
        province: tags['addr:province'] || tags['addr:state'] || null,
        phone: tags.phone || tags['contact:phone'] || null,
        website: tags.website || tags['contact:website'] || brandRecord?.website || null,
        opening_hours: tags.opening_hours || null,
        is_open_24h: tags.opening_hours === '24/7',
        amenities: [
          tags.shop ? String(tags.shop) : null,
          tags.toilets === 'yes' ? 'toilets' : null,
          tags.restaurant === 'yes' ? 'restaurant' : null,
          tags.car_wash === 'yes' ? 'car_wash' : null,
        ].filter(Boolean),
        fuel_types: fuelTypes(tags),
        source: 'openstreetmap',
        source_url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
        source_updated_at: tags.check_date || tags['survey:date'] || null,
        live: true,
      };
    }).filter(Boolean).slice(0, 500);

    return Response.json({ stations, count: stations.length, source: 'OpenStreetMap', live: true, fetched_at: new Date().toISOString() });
  } catch (error) {
    console.error('get-fuel-stations:', error);
    return Response.json({ stations: [], error: 'Fuel station lookup failed' }, { status: 200 });
  }
}