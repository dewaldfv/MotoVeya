import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/oapi/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'MotoVeya/1.0 (https://motoveya.base44.app fuel map layer)';

const BRAND_ALIASES: Record<string,string> = {
  engen:'engen','engen petroleum':'engen',
  astron:'astron energy','astron energy':'astron energy',caltex:'caltex',
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
function amenities(tags: any) {
  return [
    tags?.shop ? String(tags.shop) : null,
    tags?.toilets === 'yes' ? 'toilets' : null,
    tags?.restaurant === 'yes' ? 'restaurant' : null,
    tags?.car_wash === 'yes' ? 'car_wash' : null,
  ].filter(Boolean);
}

function stationFromTags(id: string, type: string, lat: number, lng: number, tags: any, extras: any = {}) {
  return {
    id: `fuel-${type}-${id}`,
    source_id: `${type}/${id}`,
    name: stationName(tags),
    lat, lng,
    brand: tags.brand || null,
    raw_brand: tags.brand || null,
    operator: tags.operator || null,
    address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'],
      tags['addr:city'] || tags['addr:town'] || tags['addr:village']].filter(Boolean).join(', '),
    town: tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || null,
    province: tags['addr:province'] || tags['addr:state'] || null,
    phone: tags.phone || tags['contact:phone'] || null,
    website: tags.website || tags['contact:website'] || null,
    opening_hours: tags.opening_hours || null,
    is_open_24h: tags.opening_hours === '24/7',
    amenities: amenities(tags),
    fuel_types: fuelTypes(tags),
    source: 'openstreetmap',
    source_url: `https://www.openstreetmap.org/${type}/${id}`,
    source_updated_at: tags.check_date || tags['survey:date'] || null,
    live: true,
    ...extras,
  };
}

/** Primary source: OSM place search, fast and carries brand + opening-hours tags. */
async function fetchNominatim(lat: number, lng: number, radius: number) {
  const dLat = Math.min(radius / 111000, 0.22);
  const dLng = dLat / Math.max(0.25, Math.cos(lat * Math.PI / 180));
  const viewbox = `${lng - dLng},${lat + dLat},${lng + dLng},${lat - dLat}`;
  const url = `${NOMINATIM_URL}?format=jsonv2&limit=50&extratags=1&bounded=1&dedupe=1&viewbox=${viewbox}&q=fuel`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
    if (!response.ok) throw new Error(`Nominatim ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((row: any) => (row?.category || row?.class) === 'amenity' && row?.type === 'fuel')
      .map((row: any) => {
        const tags = row.extratags || {};
        const osmType = row.osm_type || 'node';
        return {
          ...stationFromTags(String(row.osm_id), osmType, Number(row.lat), Number(row.lon), {
            ...tags,
            name: row.name || tags.name || null,
          }, { address: row.display_name || null, source: 'nominatim' }),
        };
      })
      .filter((station: any) => Number.isFinite(station.lat) && Number.isFinite(station.lng));
  } catch (error) {
    console.warn('Fuel station search source failed:', String(error).slice(0, 160));
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Denser fallback: Overpass, raced across mirrors since they are often busy. */
async function fetchOverpass(lat: number, lng: number, radius: number) {
  const query = `[out:json][timeout:20];nwr[amenity=fuel](around:${radius},${lat},${lng});out center tags;`;
  const attempts = ENDPOINTS.map(async (endpoint) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': USER_AGENT },
        body: query,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data?.elements)) throw new Error('Overpass: no elements');
      return data.elements;
    } finally {
      clearTimeout(timer);
    }
  });
  try {
    return await Promise.any(attempts);
  } catch (error) {
    console.warn('Overpass unavailable:', String(error).slice(0, 160));
    return [];
  }
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

    let brands: any[] = [];
    try { brands = await base44.entities.FuelBrand.list('-name', 100); }
    catch (error) { console.warn('FuelBrand lookup failed:', error); }

    const brandByNormalized = new Map(
      brands.filter((b: any) => b?.active !== false)
        .map((b: any) => [String(b.normalized_name || b.name || '').toLowerCase().trim(), b])
    );

    let stations = await fetchNominatim(lat, lng, radius);
    let source = 'OpenStreetMap search';

    if (!stations.length) {
      const elements = await fetchOverpass(lat, lng, radius);
      source = 'OpenStreetMap';
      stations = elements.map((el: any) => {
        const p = el.lat != null ? [el.lat, el.lon] : [el.center?.lat, el.center?.lon];
        if (p[0] == null || p[1] == null) return null;
        return stationFromTags(String(el.id), el.type, Number(p[0]), Number(p[1]), el.tags || {});
      }).filter(Boolean);
    }

    const deduped = new Map<string, any>();
    for (const station of stations) {
      if (!station) continue;
      if (!deduped.has(station.source_id)) deduped.set(station.source_id, station);
    }

    const enriched = Array.from(deduped.values()).slice(0, 500).map((station: any) => {
      const normalized = normalizeBrand(station.raw_brand || station.operator || (station.source === 'nominatim' ? station.name : null));
      const brandRecord = normalized ? brandByNormalized.get(normalized) : null;
      return {
        ...station,
        brand: brandRecord?.name || station.brand || null,
        brand_id: brandRecord?.id || null,
        logo_url: brandRecord?.marker_logo_url || brandRecord?.logo_url || null,
        primary_colour: brandRecord?.primary_colour || null,
      };
    });

    return Response.json({
      stations: enriched,
      count: enriched.length,
      source,
      live: true,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('get-fuel-stations:', error);
    return Response.json({ stations: [], error: 'Fuel station lookup failed' }, { status: 200 });
  }
}