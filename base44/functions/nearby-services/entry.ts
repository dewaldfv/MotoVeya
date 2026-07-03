import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function categorizeByTags(tags) {
  if (!tags) return 'other';
  if (tags.shop === 'motorcycle') return 'dealership';
  if (tags.shop === 'motorcycle_repair') return 'workshop';
  if (tags.shop === 'tyres') return 'tyres';
  if (tags.amenity === 'fuel') return 'fuel';
  if (['cafe', 'restaurant', 'fast_food', 'pub', 'bar'].includes(tags.amenity)) return 'food';
  if (['hotel', 'guest_house', 'camp_site', 'hostel', 'motel'].includes(tags.tourism)) return 'accommodation';
  if (tags.amenity === 'car_wash') return 'wash';
  if (tags.amenity === 'car_repair' || tags.shop === 'car_repair') return 'workshop';
  return 'other';
}

function buildOverpassQuery(lat, lng, radiusM) {
  const a = `${radiusM},${lat},${lng}`;
  return `[out:json][timeout:25];
(
  nwr["shop"="motorcycle"](around:${a});
  nwr["shop"="motorcycle_repair"](around:${a});
  nwr["shop"="tyres"](around:${a});
  nwr["amenity"="fuel"](around:${a});
  nwr["amenity"="cafe"](around:${a});
  nwr["amenity"="restaurant"](around:${a});
  nwr["amenity"="fast_food"](around:${a});
  nwr["amenity"="pub"](around:${a});
  nwr["tourism"="hotel"](around:${a});
  nwr["tourism"="guest_house"](around:${a});
  nwr["tourism"="camp_site"](around:${a});
  nwr["tourism"="motel"](around:${a});
  nwr["amenity"="car_wash"](around:${a});
  nwr["amenity"="car_repair"](around:${a});
);
out center tags;`;
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { lat, lng, radius = 50 } = body;

    if (!lat || !lng) {
      return Response.json({ error: 'lat and lng are required' }, { status: 400 });
    }

    const radiusM = Math.min(Math.max(radius, 5), 200) * 1000;
    const query = buildOverpassQuery(lat, lng, radiusM);

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'User-Agent': 'MotoGoApp/1.0' },
      body: 'data=' + encodeURIComponent(query),
    });

    if (!response.ok) {
      console.error('Overpass API error:', response.status);
      return Response.json({ error: 'Failed to fetch nearby services' }, { status: 502 });
    }

    const data = await response.json();
    const elements = data.elements || [];

    const services = elements
      .map((el) => {
        const sLat = el.lat || el.center?.lat;
        const sLng = el.lon || el.center?.lon;
        if (!sLat || !sLng || !el.tags?.name) return null;

        const category = categorizeByTags(el.tags);
        const distance = haversine(lat, lng, sLat, sLng);

        return {
          id: `${el.type}_${el.id}`,
          name: el.tags.name,
          category,
          lat: sLat,
          lng: sLng,
          distance: Math.round(distance * 10) / 10,
          phone: el.tags.phone || el.tags['contact:phone'] || null,
          website: el.tags.website || el.tags['contact:website'] || el.tags.url || null,
          address: [el.tags['addr:housenumber'], el.tags['addr:street'], el.tags['addr:city'], el.tags['addr:province']].filter(Boolean).join(' ') || null,
          opening_hours: el.tags.opening_hours || null,
          rating: null,
          photo_url: null,
          tags: el.tags,
        };
      })
      .filter(Boolean)
      .filter((s) => s.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 150);

    return Response.json({ services, count: services.length, source: 'overpass' });
  } catch (error) {
    console.error('Nearby services error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});