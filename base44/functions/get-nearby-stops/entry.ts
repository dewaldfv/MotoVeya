Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const type = body?.type === 'food' ? 'food' : 'fuel';
    const radiusM = Math.min(Number(body?.radius) || 12000, 25000);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json({ error: 'lat and lng are required' }, { status: 400 });
    }

    const amenityFilter =
      type === 'fuel'
        ? '["amenity"="fuel"]'
        : '["amenity"~"^(pub|cafe|restaurant|fast_food)$"]';

    const query = `[out:json][timeout:20];(
      node${amenityFilter}(around:${radiusM},${lat},${lng});
    );out body 40;`;

    // Race all Overpass endpoints in parallel and take the first successful response.
    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    ];
    const tryFetch = (url) => new Promise((resolve, reject) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'MotoGo-App/1.0' },
        body: 'data=' + encodeURIComponent(query),
        signal: ctrl.signal,
      }).then((r) => {
        clearTimeout(timer);
        if (r.ok) resolve(r);
        else reject(new Error(`status ${r.status}`));
      }).catch((e) => { clearTimeout(timer); reject(e); });
    });

    let res = null;
    try {
      res = await Promise.any(endpoints.map(tryFetch));
    } catch (e) {
      res = null;
    }

    if (!res) {
      // No endpoint responded — return an empty list so the UI falls back gracefully
      // (the suggested stop point itself is still shown on the map).
      return Response.json({ type, candidates: [], unavailable: true });
    }

    const json = await res.json();
    const elements = (json.elements || []).filter((e) => e.lat && e.lon);

    const haversineKm = (a, b) => {
      const R = 6371;
      const toRad = (d) => (d * Math.PI) / 180;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(s));
    };

    const candidates = elements
      .map((el) => {
        const tags = el.tags || {};
        const name = tags.name || tags.brand || (type === 'fuel' ? 'Fuel station' : 'Eatery');
        return {
          id: `${el.type}-${el.id}`,
          name,
          amenity: tags.amenity || (type === 'fuel' ? 'fuel' : 'food'),
          lat: el.lat,
          lng: el.lon,
          dist_km: Math.round(haversineKm({ lat, lng }, { lat: el.lat, lng: el.lon }) * 10) / 10,
        };
      })
      .sort((a, b) => a.dist_km - b.dist_km)
      .slice(0, 5);

    return Response.json({ type, candidates });
  } catch (error) {
    console.error('get-nearby-stops error:', error.message);
    return Response.json({ error: 'Failed to fetch nearby stops' }, { status: 500 });
  }
});