import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

function normalize(tags: any) {
  return tags?.name || tags?.brand || tags?.operator || 'Fuel Station';
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await base44.auth.me())) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const radius = Math.min(Math.max(Number(body.radius || 25000), 1000), 25000);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json({ stations: [], error: 'lat and lng are required' }, { status: 400 });
    }

    // Nodes, ways and relations are included so stations mapped as a site/area are not missed.
    const query = `[out:json][timeout:30];nwr[amenity=fuel](around:${radius},${lat},${lng});out center tags;`;

    const fetchOne = async (url: string) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
          'User-Agent': 'MotoVeya/1.0 fuel station map layer',
        },
        body: query,
      });
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      return response.json();
    };

    let data: any = null;
    for (const endpoint of ENDPOINTS) {
      try {
        data = await fetchOne(endpoint);
        break;
      } catch (error) {
        console.warn('Fuel station endpoint failed:', endpoint, error);
      }
    }
    if (!data) return Response.json({ stations: [], unavailable: true });

    const seen = new Set<string>();
    const stations = (data.elements || []).map((el: any) => {
      const p = el.lat != null ? [el.lat, el.lon] : [el.center?.lat, el.center?.lon];
      if (p[0] == null || p[1] == null) return null;
      const tags = el.tags || {};
      const id = `${el.type}/${el.id}`;
      if (seen.has(id)) return null;
      seen.add(id);
      return {
        id: `fuel-${el.type}-${el.id}`,
        source_id: id,
        name: normalize(tags),
        lat: Number(p[0]),
        lng: Number(p[1]),
        brand: tags.brand || null,
        operator: tags.operator || null,
        address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(', '),
        town: tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || null,
        phone: tags.phone || tags['contact:phone'] || null,
        website: tags.website || tags['contact:website'] || null,
        opening_hours: tags.opening_hours || null,
        is_open_24h: tags.opening_hours === '24/7',
        amenities: [tags.shop, tags.toilets === 'yes' ? 'toilets' : null, tags.restaurant === 'yes' ? 'restaurant' : null].filter(Boolean),
        source: 'openstreetmap',
      };
    }).filter(Boolean).slice(0, 500);

    return Response.json({ stations, count: stations.length });
  } catch (error) {
    console.error('get-fuel-stations:', error);
    return Response.json({ stations: [], error: 'Fuel station lookup failed' }, { status: 200 });
  }
}
